import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

loadEnv(".env.local");
loadEnv(".env");

const prisma = new PrismaClient();
const batchSize = Number(process.env.WORKER_BATCH_SIZE ?? 3);

try {
  const jobs = await prisma.backgroundJob.findMany({
    where: { status: "queued", runAfter: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: batchSize
  });

  for (const job of jobs) {
    await processJob(job);
  }

  console.log(`Processed ${jobs.length} queued job(s).`);
} finally {
  await prisma.$disconnect();
}

async function processJob(job) {
  await prisma.backgroundJob.update({
    where: { id: job.id },
    data: { status: "running", attempts: { increment: 1 }, lockedAt: new Date() }
  });

  try {
    if (job.jobType !== "evaluate_run") {
      throw new Error(`Unsupported job type: ${job.jobType}`);
    }

    const { runId } = job.payloadJson;
    await evaluateRun(runId);

    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: { status: "completed", errorMessage: null }
    });
  } catch (error) {
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown worker error"
      }
    });
  }
}

async function evaluateRun(runId) {
  const run = await prisma.run.findUniqueOrThrow({
    where: { id: runId },
    include: {
      promptVersion: true,
      items: {
        where: { status: "queued" },
        include: { datasetCase: true },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  await prisma.run.update({
    where: { id: runId },
    data: { status: "running", startedAt: run.startedAt ?? new Date() }
  });

  let passed = 0;
  let failed = 0;
  let totalScore = 0;
  let totalCost = 0;

  for (const item of run.items) {
    const result = await callProvider(run, item);
    const score = scoreOutput(result.text);
    const status = score >= 0.85 ? "passed" : score >= 0.7 ? "warning" : "failed";
    if (status === "passed") passed += 1;
    if (status === "failed") failed += 1;
    totalScore += score;
    totalCost += result.costEstimate;

    await prisma.$transaction(async (tx) => {
      await tx.runItem.update({
        where: { id: item.id },
        data: {
          status,
          outputSnapshotJson: result.json ?? { text: result.text },
          score,
          completedAt: new Date()
        }
      });

      const trace = await tx.trace.create({
        data: {
          workspaceId: run.workspaceId,
          runItemId: item.id,
          traceKey: `trace_${item.id}`,
          status: "completed",
          totalDurationMs: result.latencyMs,
          totalTokens: result.usage.totalTokens,
          totalCost: result.costEstimate
        }
      });

      const span = await tx.traceSpan.create({
        data: {
          workspaceId: run.workspaceId,
          traceId: trace.id,
          spanType: "model",
          name: `${run.provider}:${run.modelName}`,
          inputJson: item.inputSnapshotJson,
          outputJson: result.json ?? { text: result.text },
          durationMs: result.latencyMs,
          tokensIn: result.usage.inputTokens,
          tokensOut: result.usage.outputTokens,
          status,
          metadataJson: { provider: run.provider, model: run.modelName }
        }
      });

      await tx.modelCall.create({
        data: {
          workspaceId: run.workspaceId,
          runItemId: item.id,
          traceSpanId: span.id,
          promptVersionId: run.promptVersionId,
          provider: run.provider,
          modelName: run.modelName,
          temperature: Number(run.modelParamsJson?.temperature ?? 0.2),
          topP: Number(run.modelParamsJson?.topP ?? 1),
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          latencyMs: result.latencyMs,
          costEstimate: result.costEstimate,
          rawText: result.text,
          structuredJson: result.json,
          requestJson: result.request,
          responseJson: result.raw,
          status
        }
      });
    });
  }

  const completedItems = await prisma.runItem.count({ where: { runId, status: { not: "queued" } } });
  const denominator = Math.max(completedItems, 1);
  await prisma.run.update({
    where: { id: runId },
    data: {
      status: "completed",
      completedAt: new Date(),
      passedCases: passed,
      failedCases: failed,
      averageScore: totalScore / denominator,
      totalCost
    }
  });
}

async function callProvider(run, item) {
  const prompt = render(run.promptVersion.userPromptTemplate, item.datasetCase.inputPayloadJson ?? {});
  const system = run.promptVersion.systemPrompt;
  const started = performance.now();
  const request = {
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt }
    ]
  };

  if (run.provider === "groq") {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: run.modelName,
        messages: request.messages,
        temperature: Number(run.modelParamsJson?.temperature ?? 0.2)
      })
    });
    const raw = await response.json();
    const text = raw.choices?.[0]?.message?.content ?? "";
    const usage = {
      inputTokens: raw.usage?.prompt_tokens ?? 0,
      outputTokens: raw.usage?.completion_tokens ?? 0,
      totalTokens: raw.usage?.total_tokens ?? 0
    };
    return normalizeProviderResult({ raw, text, usage, request, started, rate: 0.0000004 });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${run.modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: Number(run.modelParamsJson?.temperature ?? 0.2) }
      })
    }
  );
  const raw = await response.json();
  const text = raw.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  const usage = {
    inputTokens: raw.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: raw.usageMetadata?.candidatesTokenCount ?? 0,
    totalTokens: raw.usageMetadata?.totalTokenCount ?? 0
  };
  return normalizeProviderResult({ raw, text, usage, request, started, rate: 0.00000035 });
}

function normalizeProviderResult({ raw, text, usage, request, started, rate }) {
  return {
    raw,
    text,
    json: parseJson(text),
    usage,
    request,
    latencyMs: Math.round(performance.now() - started),
    costEstimate: Number((usage.totalTokens * rate).toFixed(6))
  };
}

function render(template, variables) {
  return Object.entries(variables).reduce(
    (value, [key, replacement]) => value.replaceAll(`{{${key}}}`, String(replacement)),
    template
  );
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function scoreOutput(text) {
  return text.trim().length > 20 ? 0.9 : 0.65;
}

function loadEnv(file) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (!process.env[key]) {
      process.env[key] = value.replace(/^"|"$/g, "");
    }
  }
}
