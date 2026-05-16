import type { RunItemStatus, RunStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/ai";
import { RequestContextError, type RequestContext } from "@/server/context";
import { EventService } from "@/server/services/event-service";
import { JobService } from "@/server/services/job-service";
import { ProviderCredentialService } from "@/server/services/provider-credential-service";

type ReviewVerdict = "approved" | "needs_fix" | "rejected";

export class GradingService {
  private readonly jobs = new JobService();
  private readonly credentials = new ProviderCredentialService();

  getDefinitions(context: RequestContext) {
    return prisma.graderDefinition.findMany({
      where: {
        workspaceId: context.workspaceId,
        status: { not: "archived" }
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }]
    });
  }

  async createDefinition(
    context: RequestContext,
    input: {
      name: string;
      description?: string;
      type?: string;
      provider: "groq" | "gemini" | "ollama";
      modelName: string;
      promptTemplate: string;
      rubricJson?: Record<string, unknown>;
    }
  ) {
    const definition = await prisma.graderDefinition.create({
      data: {
        workspaceId: context.workspaceId,
        name: input.name,
        description: input.description,
        type: input.type ?? "llm_rubric",
        rubricJson: (input.rubricJson ?? {}) as Prisma.InputJsonValue,
        provider: input.provider,
        modelName: input.modelName,
        promptTemplate: input.promptTemplate,
        status: "active",
        createdBy: context.userId
      }
    });

    await new EventService().emit(context, {
      entityType: "grader_definition",
      entityId: definition.id,
      action: "grader_definition_created",
      payload: {
        name: definition.name,
        type: definition.type,
        provider: definition.provider,
        modelName: definition.modelName
      }
    });

    return definition;
  }

  async deleteDefinition(context: RequestContext, definitionId: string) {
    const definition = await prisma.graderDefinition.update({
      where: { id: definitionId, workspaceId: context.workspaceId },
      data: { status: "archived" }
    });

    await new EventService().emit(context, {
      entityType: "grader_definition",
      entityId: definition.id,
      action: "grader_definition_archived",
      payload: { name: definition.name, type: definition.type }
    });

    return definition;
  }

  queue(context: RequestContext) {
    return prisma.runItem.findMany({
      where: {
        workspaceId: context.workspaceId,
        OR: [{ status: "warning" }, { status: "failed" }, { status: "needs_review" }],
        reviews: { none: {} }
      },
      include: {
        run: true,
        datasetCase: true,
        reviews: true
      },
      orderBy: { updatedAt: "desc" },
      take: 50
    });
  }

  async submitReview(
    context: RequestContext,
    input: { runItemId: string; verdict: ReviewVerdict; score?: number; notes?: string }
  ) {
    const item = await prisma.runItem.findFirst({
      where: { id: input.runItemId, workspaceId: context.workspaceId },
      include: { trace: true }
    });
    if (!item) {
      throw new RequestContextError("Run item was not found in this workspace.", 404);
    }

    return prisma.$transaction(async (tx) => {
      const review = await tx.humanReview.create({
        data: {
          workspaceId: context.workspaceId,
          runId: item.runId,
          runItemId: input.runItemId,
          reviewerUserId: context.userId,
          verdict: input.verdict,
          score: input.score,
          notes: input.notes,
          reviewedAt: new Date()
        }
      });
      const nextStatus = statusFromReviewVerdict(input.verdict, item.status);
      const trace = item.trace ??
        await tx.trace.create({
          data: {
            workspaceId: context.workspaceId,
            runItemId: item.id,
            traceKey: `review_${item.id}`,
            status: traceStatusFromItemStatus(nextStatus)
          }
        });

      await tx.runItem.update({
        where: { id: item.id },
        data: {
          score: input.score !== undefined ? input.score : item.score,
          status: nextStatus,
          completedAt: nextStatus === "passed" || nextStatus === "failed" ? new Date() : item.completedAt,
          errorMessage: nextStatus === "passed" ? null : item.errorMessage
        }
      });

      const rootSpan = await tx.traceSpan.findFirst({ where: { traceId: trace.id, spanType: "root" } });
      await tx.traceSpan.create({
        data: {
          workspaceId: context.workspaceId,
          traceId: trace.id,
          parentSpanId: rootSpan?.id,
          spanType: "review",
          name: `human_review:${input.verdict}`,
          inputJson: { runItemId: item.id } as Prisma.InputJsonValue,
          outputJson: { verdict: input.verdict, score: input.score, notes: input.notes } as Prisma.InputJsonValue,
          durationMs: 0,
          status: nextStatus,
          metadataJson: { reviewerUserId: context.userId, reviewId: review.id } as Prisma.InputJsonValue
        }
      });

      await tx.trace.update({
        where: { id: trace.id },
        data: { status: traceStatusFromItemStatus(nextStatus) }
      });

      await new EventService(tx).emit(context, {
        entityType: "run_item",
        entityId: item.id,
        action: nextStatus === "passed" ? "review_approved" : "review_rejected",
        payload: { reviewId: review.id, runId: item.runId, verdict: input.verdict, score: input.score, status: nextStatus }
      });

      await this.finalizeRunStatus(tx, context, item.runId);

      return review;
    });
  }

  async autoGrade(context: RequestContext, input: { runItemId: string; graderDefinitionId: string }) {
    const [item, grader] = await Promise.all([
      prisma.runItem.findFirstOrThrow({
        where: { id: input.runItemId, workspaceId: context.workspaceId },
        include: { trace: true, datasetCase: true }
      }),
      prisma.graderDefinition.findFirstOrThrow({
        where: { id: input.graderDefinitionId, workspaceId: context.workspaceId }
      })
    ]);

    const trace =
      item.trace ??
      await prisma.trace.create({
        data: {
          workspaceId: context.workspaceId,
          runItemId: item.id,
          traceKey: `auto_grade_${item.id}`,
          status: "running"
        }
      });

    const provider = getProvider(grader.provider);
    const credential = await this.credentials.resolveSecret(context, grader.provider);
    
    try {
      await new EventService().emitRaw({
        workspaceId: context.workspaceId,
        actorUserId: isUuid(context.userId) ? context.userId : null,
        entityType: "run_item",
        entityId: item.id,
        action: "grading_started",
        payload: { runId: item.runId, graderDefinitionId: grader.id, provider: grader.provider, modelName: grader.modelName }
      });

      const result = await provider.generateStructured<{ score: number; label: string; rationale: string }>({
        provider: grader.provider,
        model: grader.modelName,
        temperature: 0,
        apiKey: grader.provider === "ollama" ? (credential && !credential.startsWith("http") ? credential : undefined) : (credential ?? undefined),
        baseUrl: grader.provider === "ollama" && credential?.startsWith("http") ? credential : undefined,
        responseSchema: {
          type: "object",
          properties: {
            score: { type: "number" },
            label: { type: "string" },
            rationale: { type: "string" }
          },
          required: ["score", "label", "rationale"]
        },
        messages: [
          { role: "system", content: grader.promptTemplate },
          {
            role: "user",
            content: JSON.stringify({
              input: item.inputSnapshotJson,
              output: item.outputSnapshotJson,
              expected: (item as any).expectedOutputSnapshotJson,
              rubric: (item as any).rubricSnapshotJson
            })
          }
        ]
      });

      return prisma.$transaction(async (tx) => {
        const label = normalizeGradeLabel(result.json.label);
        const rootSpan = await tx.traceSpan.findFirst({ where: { traceId: trace.id, spanType: "root" } });
        const span = await tx.traceSpan.create({
          data: {
            workspaceId: context.workspaceId,
            traceId: trace.id,
            parentSpanId: rootSpan?.id,
            spanType: "grader",
            name: `${grader.type}:${grader.name}`,
            inputJson: {
              input: item.inputSnapshotJson,
              output: item.outputSnapshotJson,
              expected: (item as any).expectedOutputSnapshotJson,
              rubric: (item as any).rubricSnapshotJson
            } as Prisma.InputJsonValue,
            outputJson: result.json as Prisma.InputJsonValue,
            durationMs: result.latencyMs,
            tokensIn: result.usage.inputTokens,
            tokensOut: result.usage.outputTokens,
            status: label,
            metadataJson: { provider: result.provider, model: result.model }
          }
        });

        const graderResult = await tx.graderResult.create({
          data: {
            workspaceId: context.workspaceId,
            traceId: trace.id,
            graderDefinitionId: grader.id,
            score: result.json.score,
            label,
            rationale: result.json.rationale,
            metadataJson: {
              provider: result.provider,
              model: result.model,
              usage: result.usage,
              latencyMs: result.latencyMs,
              costEstimate: result.costEstimate,
              spanId: span.id
            }
          }
        });

        await tx.runItem.update({
          where: { id: item.id },
          data: {
            status: label === "pass" ? "passed" : label === "fail" ? "failed" : "needs_review",
            score: result.json.score,
            completedAt: new Date()
          }
        });

        await this.finalizeRunStatus(tx, context, item.runId);

        await new EventService(tx).emitRaw({
          workspaceId: context.workspaceId,
          actorUserId: isUuid(context.userId) ? context.userId : null,
          entityType: "run_item",
          entityId: item.id,
          action: "grading_completed",
          payload: { runId: item.runId, graderDefinitionId: grader.id, score: result.json.score, label }
        });

        return graderResult;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "LLM Grading failed";
      await prisma.$transaction(async (tx) => {
        await tx.traceSpan.create({
          data: {
            workspaceId: context.workspaceId,
            traceId: trace.id,
            spanType: "error",
            name: "llm_grading_failed",
            outputJson: { error: message, graderDefinitionId: grader.id } as Prisma.InputJsonValue,
            durationMs: 0,
            status: "needs_review",
            metadataJson: { category: "grading_failure", provider: grader.provider, model: grader.modelName } as Prisma.InputJsonValue
          }
        });
        await tx.trace.update({
          where: { id: trace.id },
          data: { status: "needs_review" }
        });
        await tx.runItem.update({
          where: { id: item.id },
          data: { status: "needs_review", errorMessage: `Grader Error: ${message}` }
        });
        await this.finalizeRunStatus(tx, context, item.runId);
      });
      await new EventService().emitRaw({
        workspaceId: context.workspaceId,
        actorUserId: isUuid(context.userId) ? context.userId : null,
        entityType: "run_item",
        entityId: item.id,
        action: "grading_failed",
        payload: { runId: item.runId, graderDefinitionId: grader.id, error: message }
      });
      throw error;
    }
  }

  async autoGradeRun(context: RequestContext, input: { runId: string; graderDefinitionId?: string }) {
    const run = await prisma.run.findFirst({
      where: { id: input.runId, workspaceId: context.workspaceId },
      select: { id: true }
    });

    if (!run) {
      throw new RequestContextError("Run was not found in this workspace.", 404);
    }

    const graderKey = input.graderDefinitionId ?? "deterministic";
    const job = await this.jobs.enqueue({
      workspaceId: context.workspaceId,
      jobType: "auto_grade_run",
      payload: { runId: input.runId, graderDefinitionId: input.graderDefinitionId } as Prisma.InputJsonValue,
      priority: 1,
      idempotencyKey: `auto_grade_run:${input.runId}:${graderKey}`
    });

    return { jobId: job.id, message: "Grading task enqueued to background workers." };
  }

  async finalizeRunStatus(tx: Prisma.TransactionClient, context: RequestContext, runId: string) {
    const run = await tx.run.findFirstOrThrow({
      where: { id: runId, workspaceId: context.workspaceId },
      select: { status: true }
    });
    const items = await tx.runItem.findMany({
      where: { runId, workspaceId: context.workspaceId },
      select: { status: true, score: true }
    });

    const passed = items.filter((item) => item.status === "passed").length;
    const failed = items.filter((item) => item.status === "failed").length;
    const needsReview = items.filter((item) => item.status === "needs_review" || item.status === "warning").length;
    const active = items.filter((item) => item.status === "queued" || item.status === "running" || item.status === "retrying").length;
    const total = items.length;
    const scored = items.filter((item) => item.score !== null);
    const averageScore = scored.length > 0
      ? scored.reduce((sum, item) => sum + Number(item.score ?? 0), 0) / scored.length
      : 0;
    const nextStatus =
      active > 0
        ? "running"
        : failed > 0 && passed > 0
          ? "partially_failed"
          : failed > 0
            ? "failed"
            : needsReview > 0
              ? "needs_review"
              : "completed";

    await tx.run.update({
      where: { id: runId },
      data: {
        passedCases: passed,
        failedCases: failed,
        averageScore,
        status: nextStatus,
        completedAt: active > 0 ? null : new Date()
      }
    });

    if (run.status !== nextStatus) {
      await tx.runStatusEvent.create({
        data: {
          workspaceId: context.workspaceId,
          runId,
          fromStatus: run.status,
          toStatus: nextStatus,
          reason: "Run recalculated after grading or human review",
          metadataJson: { passed, failed, needsReview, active, total } as Prisma.InputJsonValue
        }
      });

      await new EventService(tx).emitRaw({
        workspaceId: context.workspaceId,
        actorUserId: isUuid(context.userId) ? context.userId : null,
        entityType: "run",
        entityId: runId,
        action: nextStatus === "failed" ? "run_failed" : nextStatus === "needs_review" ? "review_requested" : "run_completed",
        payload: { passed, failed, needsReview, active, total, averageScore }
      });
    }
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function statusFromReviewVerdict(verdict: string, fallback: RunItemStatus): RunItemStatus {
  if (verdict === "approved") return "passed";
  if (verdict === "needs_fix" || verdict === "rejected") return "failed";
  return fallback;
}

function normalizeGradeLabel(label: string) {
  const normalized = label.toLowerCase().trim();
  if (normalized === "pass" || normalized === "passed") return "pass";
  if (normalized === "fail" || normalized === "failed") return "fail";
  return "needs_review";
}

function traceStatusFromItemStatus(status: RunItemStatus): RunStatus {
  if (status === "passed") return "completed";
  if (status === "failed") return "failed";
  if (status === "needs_review" || status === "warning") return "needs_review";
  if (status === "retrying") return "retrying";
  if (status === "cancelled") return "cancelled";
  if (status === "queued") return "queued";
  return "running";
}

export function stringifyOutput(output: unknown): string {
  if (typeof output === "string") return output;
  if (output && typeof output === "object") {
    const record = output as Record<string, unknown>;
    return String(record.text ?? record.message ?? record.output ?? JSON.stringify(output));
  }
  return String(output ?? "");
}

export function parseJsonFromOutput(output: unknown): Record<string, unknown> | undefined {
  if (output && typeof output === "object" && !Array.isArray(output)) {
    return output as Record<string, unknown>;
  }
  if (typeof output === "string") {
    let clean = output.trim();
    if (clean.startsWith("```json")) {
      clean = clean.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (clean.startsWith("```")) {
      clean = clean.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    try {
      return JSON.parse(clean);
    } catch {
      // Fallback: try to find anything that looks like a JSON object in the string
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          return undefined;
        }
      }
      return undefined;
    }
  }
  return undefined;
}
