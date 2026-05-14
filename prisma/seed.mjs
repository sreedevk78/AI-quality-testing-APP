import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnv(".env");
loadEnv(".env.local");

const prisma = new PrismaClient();

const ids = {
  workspace: "11111111-1111-4111-8111-111111111111",
  user: "22222222-2222-4222-8222-222222222222",
  project: "33333333-3333-4333-8333-333333333333",
  promptV1: "44444444-4444-4444-8444-444444444441",
  promptV2: "44444444-4444-4444-8444-444444444442",
  dataset: "55555555-5555-4555-8555-555555555555",
  caseA: "66666666-6666-4666-8666-666666666661",
  caseB: "66666666-6666-4666-8666-666666666662",
  run: "77777777-7777-4777-8777-777777777777",
  runItemA: "88888888-8888-4888-8888-888888888881",
  runItemB: "88888888-8888-4888-8888-888888888882",
  trace: "99999999-9999-4999-8999-999999999999",
  grader: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
};

try {
  await prisma.user.upsert({
    where: { id: ids.user },
    update: {},
    create: {
      id: ids.user,
      authUserId: "demo-auth-user",
      fullName: "Demo AI Engineer",
      email: "demo@example.com",
      timezone: "Asia/Calcutta"
    }
  });

  await prisma.workspace.upsert({
    where: { id: ids.workspace },
    update: {},
    create: {
      id: ids.workspace,
      name: "Acme AI Workspace",
      slug: "acme-ai",
      ownerId: ids.user,
      plan: "free",
      status: "active"
    }
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: ids.workspace, userId: ids.user } },
    update: {},
    create: {
      workspaceId: ids.workspace,
      userId: ids.user,
      role: "owner",
      joinedAt: new Date()
    }
  });

  await prisma.project.upsert({
    where: { id: ids.project },
    update: {},
    create: {
      id: ids.project,
      workspaceId: ids.workspace,
      name: "Support AI",
      description: "Prompt and agent QA for support workflows.",
      createdBy: ids.user,
      defaultProvider: "groq",
      defaultModel: "llama-3.3-70b-versatile",
      tags: ["support", "qa"]
    }
  });

  await prisma.promptVersion.upsert({
    where: { id: ids.promptV1 },
    update: {},
    create: {
      id: ids.promptV1,
      workspaceId: ids.workspace,
      projectId: ids.project,
      promptKey: "support_triage",
      versionNumber: 1,
      title: "Support Triage Agent",
      systemPrompt: "You are a precise support triage assistant. Return safe, auditable JSON.",
      userPromptTemplate: "Classify this customer request: {{message}}",
      variablesSchema: { type: "object", required: ["message"] },
      provider: "groq",
      modelName: "llama-3.3-70b-versatile",
      modelParamsJson: { temperature: 0.2, topP: 1 },
      status: "archived",
      changelog: "Initial routing behavior.",
      createdBy: ids.user
    }
  });

  await prisma.promptVersion.upsert({
    where: { id: ids.promptV2 },
    update: {},
    create: {
      id: ids.promptV2,
      workspaceId: ids.workspace,
      projectId: ids.project,
      promptKey: "support_triage",
      versionNumber: 2,
      title: "Support Triage Agent",
      systemPrompt: "You are a precise support triage assistant. Return safe, auditable JSON.",
      userPromptTemplate: "Classify this customer request and include escalation rationale: {{message}}",
      variablesSchema: { type: "object", required: ["message"] },
      provider: "groq",
      modelName: "llama-3.3-70b-versatile",
      modelParamsJson: { temperature: 0.2, topP: 1 },
      status: "active",
      changelog: "Added escalation rationale.",
      createdBy: ids.user
    }
  });

  await prisma.dataset.upsert({
    where: { id: ids.dataset },
    update: {},
    create: {
      id: ids.dataset,
      workspaceId: ids.workspace,
      projectId: ids.project,
      name: "Support routing regression",
      description: "Golden test suite for support category routing.",
      sourceType: "manual",
      versionNumber: 1,
      status: "active",
      tags: ["routing", "golden"],
      createdBy: ids.user
    }
  });

  await prisma.datasetCase.upsert({
    where: { id: ids.caseA },
    update: {},
    create: {
      id: ids.caseA,
      workspaceId: ids.workspace,
      datasetId: ids.dataset,
      inputPayloadJson: { message: "I was charged twice and need a refund now." },
      expectedOutputJson: { category: "billing", escalation: true },
      rubricJson: { correctness: 0.5, policySafety: 0.3, tone: 0.2 },
      tags: ["billing", "escalation"],
      difficulty: "medium",
      createdBy: ids.user
    }
  });

  await prisma.datasetCase.upsert({
    where: { id: ids.caseB },
    update: {},
    create: {
      id: ids.caseB,
      workspaceId: ids.workspace,
      datasetId: ids.dataset,
      inputPayloadJson: { message: "Where is my package?" },
      expectedOutputJson: { category: "shipping", escalation: false },
      rubricJson: { correctness: 0.7, tone: 0.3 },
      tags: ["shipping"],
      difficulty: "easy",
      createdBy: ids.user
    }
  });

  await prisma.graderDefinition.upsert({
    where: { id: ids.grader },
    update: {},
    create: {
      id: ids.grader,
      workspaceId: ids.workspace,
      name: "Support rubric grader",
      description: "Scores routing correctness, tone, and policy safety.",
      rubricJson: { scale: "0-1", passing: 0.85 },
      provider: "gemini",
      modelName: "gemini-2.5-flash",
      promptTemplate: "Score the output against expected behavior.",
      status: "active",
      createdBy: ids.user
    }
  });

  await prisma.run.upsert({
    where: { id: ids.run },
    update: {},
    create: {
      id: ids.run,
      workspaceId: ids.workspace,
      projectId: ids.project,
      promptVersionId: ids.promptV2,
      datasetId: ids.dataset,
      provider: "groq",
      modelName: "llama-3.3-70b-versatile",
      modelParamsJson: { temperature: 0.2 },
      status: "completed",
      startedAt: new Date(),
      completedAt: new Date(),
      totalCases: 2,
      passedCases: 1,
      failedCases: 0,
      averageScore: 0.91,
      totalCost: 0.03,
      createdBy: ids.user
    }
  });

  await prisma.runItem.upsert({
    where: { id: ids.runItemA },
    update: {},
    create: {
      id: ids.runItemA,
      workspaceId: ids.workspace,
      runId: ids.run,
      datasetCaseId: ids.caseA,
      status: "passed",
      inputSnapshotJson: { message: "I was charged twice and need a refund now." },
      outputSnapshotJson: { category: "billing", escalation: true },
      score: 0.94,
      completedAt: new Date()
    }
  });

  await prisma.runItem.upsert({
    where: { id: ids.runItemB },
    update: {},
    create: {
      id: ids.runItemB,
      workspaceId: ids.workspace,
      runId: ids.run,
      datasetCaseId: ids.caseB,
      status: "warning",
      inputSnapshotJson: { message: "Where is my package?" },
      outputSnapshotJson: { category: "shipping", escalation: false },
      score: 0.79,
      completedAt: new Date()
    }
  });

  await prisma.trace.upsert({
    where: { id: ids.trace },
    update: {},
    create: {
      id: ids.trace,
      workspaceId: ids.workspace,
      runItemId: ids.runItemA,
      traceKey: "trace_demo_billing",
      status: "completed",
      totalDurationMs: 824,
      totalTokens: 796,
      totalCost: 0.012
    }
  });

  await prisma.traceSpan.createMany({
    data: [
      {
        workspaceId: ids.workspace,
        traceId: ids.trace,
        spanType: "model",
        name: "Groq support triage call",
        inputJson: { message: "I was charged twice and need a refund now." },
        outputJson: { category: "billing", escalation: true },
        durationMs: 824,
        tokensIn: 612,
        tokensOut: 184,
        status: "passed",
        metadataJson: { provider: "groq" }
      },
      {
        workspaceId: ids.workspace,
        traceId: ids.trace,
        spanType: "grader",
        name: "Rubric grader",
        inputJson: { rubric: "support" },
        outputJson: { score: 0.94, label: "pass" },
        durationMs: 220,
        tokensIn: 210,
        tokensOut: 72,
        status: "passed",
        metadataJson: { provider: "gemini" }
      }
    ],
    skipDuplicates: true
  });

  console.log("Seeded demo workspace, prompt, dataset, run, trace, and grader data.");
} finally {
  await prisma.$disconnect();
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
