import type { BackgroundJob, Prisma, Run, RunItem, RunItemStatus, RunStatus } from "@prisma/client";
import { AIProviderError } from "@/lib/ai/types";
import { getProvider } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import type { RequestContext } from "@/server/context";
import { gradeDeterministically } from "@/server/evaluation/grading-engine";
import { EventService } from "@/server/services/event-service";
import { JobService } from "@/server/services/job-service";
import { PromptService } from "@/server/services/prompt-service";
import { ProviderCredentialService } from "@/server/services/provider-credential-service";
import { stringifyOutput } from "@/server/services/grading-service";

const terminalRunStatuses = ["completed", "failed", "cancelled", "partially_failed", "needs_review"] as const;
const activeItemStatuses = ["queued", "retrying"] as const;
const executionTransactionOptions = { maxWait: 10_000, timeout: 45_000 } as const;
type AutoGradeRunItem = Prisma.RunItemGetPayload<{ include: { trace: true; datasetCase: true; run: true } }>;

export class RunExecutionService {
  private readonly events = new EventService();
  private readonly jobs = new JobService();
  private readonly prompts = new PromptService();
  private readonly credentials = new ProviderCredentialService();

  async processJob(job: BackgroundJob, workerId: string, heartbeat?: () => Promise<void>) {
    try {
      const payload = job.payloadJson as Record<string, unknown>;
      
      switch (job.jobType) {
        case "evaluate_run": {
          if (!payload.runId) throw new Error("evaluate_run job is missing runId");
          const summary = await this.executeRun(payload.runId as string, { 
            workerId, 
            retryOnlyFailed: Boolean(payload.retryOnlyFailed),
            heartbeat
          });
          await this.jobs.complete(job, workerId, summary);
          break;
        }
        case "auto_grade_run": {
          if (!payload.runId) throw new Error("auto_grade_run job is missing runId");
          const summary = await this.processAutoGradeRun(job.workspaceId, payload.runId as string, payload.graderDefinitionId as string | undefined);
          await this.jobs.complete(job, workerId, summary);
          break;
        }
        default:
          throw new Error(`Unsupported job type: ${job.jobType}`);
      }
    } catch (error) {
      await this.jobs.fail(job, workerId, error);
      const payload = job.payloadJson as { runId?: string };
      if (payload.runId && job.attempts >= job.maxAttempts) {
        await this.failRunFromJob(job.workspaceId, payload.runId, error);
      }
    }
  }

  async processAutoGradeRun(workspaceId: string, runId: string, graderDefinitionId?: string) {
    const { GradingService } = await import("@/server/services/grading-service");
    const grading = new GradingService();
    const context: RequestContext = { workspaceId, userId: "system", role: "admin" };
    
    const items = await prisma.runItem.findMany({
      where: {
        workspaceId,
        runId,
        status: { in: ["passed", "failed", "warning", "needs_review"] },
        reviews: { none: {} }
      },
      include: { trace: true, datasetCase: true, run: true }
    });

    let graded = 0;
    let failed = 0;

    for (const item of items) {
      try {
        if (graderDefinitionId) {
          await grading.autoGrade(context, { runItemId: item.id, graderDefinitionId });
        } else {
          // Deterministic fallback if no grader ID provided
          await this.executeDeterministicGrading(context, item);
        }
        graded++;
      } catch (err) {
        console.error(`[Worker] Failed to grade item ${item.id}:`, err);
        failed++;
      }
    }

    return { runId, graded, failed };
  }

  private async executeDeterministicGrading(context: RequestContext, item: AutoGradeRunItem) {
    const started = Date.now();
    const outputText = stringifyOutput(item.outputSnapshotJson);
    const grading = gradeDeterministically({
      outputText,
      outputJson: item.outputSnapshotJson,
      expectedOutput: (item as any).expectedOutputSnapshotJson,
      rubric: (item as any).rubricSnapshotJson
    });
    const itemStatus: RunItemStatus = grading.label === "pass" ? "passed" : grading.label === "fail" ? "failed" : "needs_review";

    await prisma.$transaction(async (tx) => {
      const trace = await tx.trace.upsert({
        where: { runItemId: item.id },
        update: {
          status: traceStatusFromRunItemStatus(itemStatus)
        },
        create: {
          workspaceId: context.workspaceId,
          runItemId: item.id,
          traceKey: `auto_grade_deterministic_${item.id}`,
          status: traceStatusFromRunItemStatus(itemStatus)
        }
      });

      const gradingSpan = await tx.traceSpan.create({
        data: {
          workspaceId: context.workspaceId,
          traceId: trace.id,
          spanType: "grader",
          name: "deterministic_aggregate",
          inputJson: {
            output: item.outputSnapshotJson,
            expected: (item as any).expectedOutputSnapshotJson,
            rubric: (item as any).rubricSnapshotJson
          } as Prisma.InputJsonValue,
          outputJson: grading as unknown as Prisma.InputJsonValue,
          durationMs: Math.max(1, Date.now() - started),
          status: grading.label,
          metadataJson: {
            type: "deterministic_aggregate",
            failureCategories: grading.failureCategories,
            source: "auto_grade_run"
          } as Prisma.InputJsonValue
        }
      });

      await tx.graderResult.create({
        data: {
          workspaceId: context.workspaceId,
          traceId: trace.id,
          score: grading.score,
          label: grading.label,
          rationale: grading.explanation,
          metadataJson: {
            type: "deterministic_aggregate",
            metrics: grading.metrics,
            failureCategories: grading.failureCategories,
            gradingSpanId: gradingSpan.id
          } as Prisma.InputJsonValue
        }
      });

      await tx.runItem.update({
        where: { id: item.id },
        data: {
          status: itemStatus,
          score: grading.score,
          completedAt: new Date()
        }
      });

      await tx.trace.update({
        where: { id: trace.id },
        data: {
          status: traceStatusFromRunItemStatus(itemStatus),
          totalDurationMs: Math.max(1, Date.now() - started)
        }
      });
      
      const { GradingService } = await import("@/server/services/grading-service");
      await new GradingService().finalizeRunStatus(tx, context, item.runId);
    });
  }

  async executeRun(runId: string, options: { workerId: string; retryOnlyFailed?: boolean; heartbeat?: () => Promise<void> }) {
    const run = await prisma.run.findUniqueOrThrow({
      where: { id: runId },
      include: { promptVersion: true }
    });

    if (run.status === "cancelled") {
      return { runId, status: "cancelled", processed: 0 };
    }

    await this.transitionRun(run, "initializing", "Worker leased evaluation run", { workerId: options.workerId });

    const items = await prisma.runItem.findMany({
      where: {
        workspaceId: run.workspaceId,
        runId,
        status: options.retryOnlyFailed ? { in: ["failed", "warning", "needs_review", "retrying"] } : { in: [...activeItemStatuses] },
        // IMPORTANT: Never retry items that have already been human-reviewed
        reviews: {
          none: {}
        }
      },
      include: { datasetCase: true },
      orderBy: { createdAt: "asc" }
    });

    await this.transitionRun(run, items.some((item) => item.status === "retrying") ? "retrying" : "running", "Run item execution started", {
      itemCount: items.length
    });

    let processed = 0;
    const { default: pLimit } = await import("p-limit");
    const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 10);
    const limit = pLimit(concurrency);
    const abortController = new AbortController();
    let lastHeartbeat = Date.now();

    const tasks = items.map((item) => limit(async () => {
      if (abortController.signal.aborted) return;

      const stillActive = await this.leaseRunItem(item);
      if (!stillActive) return;

      const currentRun = await prisma.run.findUnique({ where: { id: runId }, select: { status: true } });
      if (currentRun?.status === "cancelled") {
        abortController.abort("Run was cancelled");
        await prisma.runItem.update({ where: { id: item.id }, data: { status: "cancelled", completedAt: new Date() } });
        return;
      }

      await this.executeRunItem(run, item, abortController.signal);
      processed += 1;

      if (options.heartbeat && Date.now() - lastHeartbeat > 30000) {
        lastHeartbeat = Date.now();
        await options.heartbeat().catch(() => {});
      }
    }));

    await Promise.all(tasks);

    const summary = await this.finalizeRun(runId);
    return { runId, processed, ...summary };
  }

  private async leaseRunItem(item: RunItem) {
    const update = await prisma.runItem.updateMany({
      where: { id: item.id, status: { in: ["queued", "retrying", "failed", "warning", "needs_review"] } },
      data: {
        status: "running",
        startedAt: item.startedAt ?? new Date(),
        completedAt: null,
        errorMessage: null
      }
    });

    return update.count === 1;
  }

  private async executeRunItem(
    run: Run & { promptVersion: { systemPrompt: string; userPromptTemplate: string } },
    item: RunItem & { datasetCase: { inputPayloadJson: unknown; expectedOutputJson: unknown; rubricJson: unknown } },
    abortSignal?: AbortSignal
  ) {
    const started = Date.now();
    const trace = await this.ensureTrace(run, item);
    const rootSpan = await prisma.traceSpan.create({
      data: {
        workspaceId: run.workspaceId,
        traceId: trace.id,
        spanType: "root",
        name: `run:${run.id}:case:${item.datasetCaseId}`,
        inputJson: item.inputSnapshotJson as Prisma.InputJsonValue,
        status: "running",
        metadataJson: {
          runId: run.id,
          runItemId: item.id,
          promptVersionId: run.promptVersionId,
          datasetCaseId: item.datasetCaseId,
          retryCount: item.retryCount
        }
      }
    });

    try {
      await this.events.emitRaw({
        workspaceId: run.workspaceId,
        actorUserId: run.createdBy,
        entityType: "run_item",
        entityId: item.id,
        action: "model_call_started",
        payload: { provider: run.provider, model: run.modelName, runId: run.id }
      });

      const variables = stringifyVariables(item.inputSnapshotJson);
      const renderedUserPrompt = this.prompts.render(run.promptVersion.userPromptTemplate, variables);
      const credential = await this.credentials.resolveSecret({ workspaceId: run.workspaceId }, run.provider);
      const modelRequest = {
        provider: run.provider,
        model: run.modelName,
        messages: [
          { role: "system" as const, content: run.promptVersion.systemPrompt },
          { role: "user" as const, content: renderedUserPrompt }
        ],
        temperature: Number((run.modelParamsJson as { temperature?: number })?.temperature ?? 0.2),
        topP: Number((run.modelParamsJson as { topP?: number })?.topP ?? 1),
        apiKey: run.provider === "ollama" ? (credential && !credential.startsWith("http") ? credential : undefined) : (credential ?? undefined),
        baseUrl: run.provider === "ollama" && credential?.startsWith("http") ? credential : undefined,
        abortSignal
      };

      const provider = getProvider(run.provider);
      const { abortSignal: _, ...serializableModelRequest } = modelRequest;
      const response = await provider.generate(modelRequest);
      const grading = gradeDeterministically({
        outputText: response.text,
        outputJson: response.json,
        expectedOutput: (item as any).expectedOutputSnapshotJson,
        rubric: (item as any).rubricSnapshotJson,
        passThreshold: Number((run.modelParamsJson as { passThreshold?: number })?.passThreshold ?? 0.85),
        reviewThreshold: Number((run.modelParamsJson as { reviewThreshold?: number })?.reviewThreshold ?? 0.7)
      });
      const itemStatus = grading.label === "pass" ? "passed" : grading.label === "fail" ? "failed" : "needs_review";

      await prisma.$transaction(async (tx) => {
        const modelSpan = await tx.traceSpan.create({
          data: {
            workspaceId: run.workspaceId,
            traceId: trace.id,
            parentSpanId: rootSpan.id,
            spanType: "model",
            name: `${run.provider}:${run.modelName}`,
            inputJson: serializableModelRequest as Prisma.InputJsonValue,
            outputJson: (response.json ?? { text: response.text }) as Prisma.InputJsonValue,
            durationMs: response.latencyMs,
            tokensIn: response.usage.inputTokens,
            tokensOut: response.usage.outputTokens,
            status: itemStatus,
            metadataJson: {
              provider: response.provider,
              model: response.model,
              costEstimate: response.costEstimate,
              rawProviderResponse: response.raw
            } as Prisma.InputJsonValue
          }
        });

        await tx.modelCall.create({
          data: {
            workspaceId: run.workspaceId,
            runItemId: item.id,
            traceSpanId: modelSpan.id,
            promptVersionId: run.promptVersionId,
            provider: run.provider,
            modelName: run.modelName,
            temperature: modelRequest.temperature,
            topP: modelRequest.topP,
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
            latencyMs: response.latencyMs,
            costEstimate: response.costEstimate,
            rawText: response.text,
            structuredJson: response.json as Prisma.InputJsonValue | undefined,
            requestJson: serializableModelRequest as Prisma.InputJsonValue,
            responseJson: response.raw as Prisma.InputJsonValue,
            status: itemStatus
          }
        });

        const gradingSpan = await tx.traceSpan.create({
          data: {
            workspaceId: run.workspaceId,
            traceId: trace.id,
            parentSpanId: rootSpan.id,
            spanType: "grader",
            name: "deterministic_aggregate",
            inputJson: {
              expected: (item as any).expectedOutputSnapshotJson,
              rubric: (item as any).rubricSnapshotJson
            } as Prisma.InputJsonValue,
            outputJson: grading as unknown as Prisma.InputJsonValue,
            durationMs: Math.max(1, Date.now() - started - response.latencyMs),
            status: grading.label,
            metadataJson: { failureCategories: grading.failureCategories }
          }
        });

        await tx.graderResult.create({
          data: {
            workspaceId: run.workspaceId,
            traceId: trace.id,
            score: grading.score,
            label: grading.label,
            rationale: grading.explanation,
            metadataJson: {
              type: "deterministic_aggregate",
              metrics: grading.metrics,
              failureCategories: grading.failureCategories,
              gradingSpanId: gradingSpan.id
            } as Prisma.InputJsonValue
          }
        });

        await tx.runItem.update({
          where: { id: item.id },
          data: {
            status: itemStatus,
            outputSnapshotJson: (response.json ?? { text: response.text }) as Prisma.InputJsonValue,
            score: grading.score,
            completedAt: new Date(),
            errorMessage: grading.failureCategories.join(", ") || null
          }
        });

        await tx.traceSpan.update({
          where: { id: rootSpan.id },
          data: {
            status: itemStatus,
            durationMs: Date.now() - started,
            outputJson: { finalStatus: itemStatus, score: grading.score } as Prisma.InputJsonValue
          }
        });

        await tx.trace.update({
          where: { id: trace.id },
          data: {
            status: itemStatus === "failed" ? "failed" : itemStatus === "needs_review" ? "needs_review" : "completed",
            totalDurationMs: Date.now() - started,
            totalTokens: response.usage.totalTokens,
            totalCost: response.costEstimate
          }
        });

        await tx.usageEvent.create({
          data: {
            workspaceId: run.workspaceId,
            userId: run.createdBy,
            runId: run.id,
            eventType: "model_call",
            provider: run.provider,
            modelName: run.modelName,
            tokensIn: response.usage.inputTokens,
            tokensOut: response.usage.outputTokens,
            costEstimate: response.costEstimate,
            occurredAt: new Date()
          }
        });

        const { GradingService } = await import("@/server/services/grading-service");
        const gradingService = new GradingService();
        const eventService = new EventService(tx);
        
        await eventService.emitRaw({
          workspaceId: run.workspaceId,
          actorUserId: run.createdBy,
          entityType: "run_item",
          entityId: item.id,
          action: "model_call_completed",
          payload: { runId: run.id, status: itemStatus, usage: response.usage, costEstimate: response.costEstimate }
        });

        // Trigger LLM grading if configured
        const graderId = (run.modelParamsJson as { graderDefinitionId?: string })?.graderDefinitionId;
        if (graderId) {
          try {
            const context: RequestContext = { workspaceId: run.workspaceId, userId: run.createdBy, role: "admin" };
            // Use existing tx for event emit if possible, but autoGrade creates its own transactions
            // We pass the context to ensure it runs under the correct workspace
            await gradingService.autoGrade(context, { runItemId: item.id, graderDefinitionId: graderId });
          } catch (gradeError) {
            console.error(`[Worker] LLM Auto-grading failed for item ${item.id}:`, gradeError);
            // We don't fail the whole item generation if grading fails, but we log it
          }
        } else {
          await eventService.emitRaw({
            workspaceId: run.workspaceId,
            actorUserId: run.createdBy,
            entityType: "run_item",
            entityId: item.id,
            action: "grading_completed",
            payload: { runId: run.id, label: grading.label, score: grading.score, metrics: grading.metrics }
          });
        }

        if (itemStatus === "needs_review") {
          await eventService.emitRaw({
            workspaceId: run.workspaceId,
            actorUserId: run.createdBy,
            entityType: "run_item",
            entityId: item.id,
            action: "review_requested",
            payload: { runId: run.id, score: grading.score, threshold: grading.threshold }
          });
        }
      }, executionTransactionOptions);
    } catch (error) {
      if (abortSignal?.aborted) {
        await prisma.$transaction(async (tx) => {
          await tx.runItem.update({ where: { id: item.id }, data: { status: "cancelled", completedAt: new Date() } });
          await tx.traceSpan.create({
            data: {
              workspaceId: run.workspaceId, traceId: trace.id, parentSpanId: rootSpan.id,
              spanType: "error", name: "run_cancelled", durationMs: Date.now() - started, status: "cancelled"
            }
          });
          await tx.trace.update({ where: { id: trace.id }, data: { status: "cancelled", totalDurationMs: Date.now() - started } });
        }, executionTransactionOptions);
      } else {
        await this.handleRunItemError(run, item, trace.id, rootSpan.id, error, Date.now() - started);
      }
    }
  }

  private async handleRunItemError(
    run: Run,
    item: RunItem,
    traceId: string,
    parentSpanId: string,
    error: unknown,
    durationMs: number
  ) {
    const transient = isTransientProviderError(error);
    const maxAttempts = Number(process.env.WORKER_MAX_ATTEMPTS ?? 3);
    const retryCount = item.retryCount + 1;
    const retryable = transient && retryCount < maxAttempts;
    const status = retryable ? "retrying" : "failed";
    const message = error instanceof Error ? error.message : "Unknown model execution error";

    await prisma.$transaction(async (tx) => {
      await tx.traceSpan.create({
        data: {
          workspaceId: run.workspaceId,
          traceId,
          parentSpanId,
          spanType: "error",
          name: retryable ? "transient_model_failure" : "terminal_model_failure",
          outputJson: { error: message, retryable, retryCount } as Prisma.InputJsonValue,
          durationMs,
          status,
          metadataJson: { category: transient ? "provider_failure" : "grading_failure" }
        }
      });

      await tx.runItem.update({
        where: { id: item.id },
        data: {
          status,
          retryCount,
          errorMessage: message,
          completedAt: retryable ? null : new Date()
        }
      });

      await tx.trace.update({
        where: { id: traceId },
        data: {
          status: retryable ? "retrying" : "failed",
          totalDurationMs: durationMs
        }
      });

      await new EventService(tx).emitRaw({
        workspaceId: run.workspaceId,
        actorUserId: run.createdBy,
        entityType: "run_item",
        entityId: item.id,
        action: retryable ? "model_call_retrying" : "model_call_failed",
        payload: { runId: run.id, error: message, retryCount }
      });
    }, executionTransactionOptions);

    if (retryable) {
      await this.jobs.enqueue({
        workspaceId: run.workspaceId,
        jobType: "evaluate_run",
        payload: { runId: run.id } as Prisma.InputJsonValue,
        runAfter: new Date(Date.now() + retryDelayMs(error, retryCount)),
        idempotencyKey: `evaluate_run:${run.id}:retry:${retryCount}`,
        priority: 1
      });
    }
  }

  private async ensureTrace(run: Run, item: RunItem) {
    return prisma.trace.upsert({
      where: { runItemId: item.id },
      update: {
        status: "running",
        totalDurationMs: null,
        totalTokens: 0,
        totalCost: 0
      },
      create: {
        workspaceId: run.workspaceId,
        runItemId: item.id,
        traceKey: `run_${run.id}_case_${item.id}`,
        status: "running"
      }
    });
  }

  private async transitionRun(run: Run, status: RunStatus, reason: string, metadata: unknown = {}) {
    const current = await prisma.run.findUniqueOrThrow({ where: { id: run.id } });
    if (current.status === status || terminalRunStatuses.includes(current.status as (typeof terminalRunStatuses)[number])) {
      return current;
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.run.update({
        where: { id: run.id },
        data: {
          status,
          startedAt: current.startedAt ?? new Date(),
          completedAt: status === "completed" || status === "failed" || status === "cancelled" ? new Date() : current.completedAt
        }
      });

      await tx.runStatusEvent.create({
        data: {
          workspaceId: run.workspaceId,
          runId: run.id,
          fromStatus: current.status,
          toStatus: status,
          reason,
          metadataJson: metadata as Prisma.InputJsonValue
        }
      });

      await new EventService(tx).emitRaw({
        workspaceId: run.workspaceId,
        actorUserId: run.createdBy,
        entityType: "run",
        entityId: run.id,
        action: status === "running" ? "run_started" : `run_${status}`,
        payload: { fromStatus: current.status, toStatus: status, reason, metadata }
      });

      return updated;
    }, executionTransactionOptions);
  }

  private async finalizeRun(runId: string) {
    const run = await prisma.run.findUniqueOrThrow({
      where: { id: runId },
      include: { items: true }
    });

    if (run.status === "cancelled") {
      return { status: "cancelled", averageScore: Number(run.averageScore ?? 0), totalCost: Number(run.totalCost) };
    }

    const passed = run.items.filter((item) => item.status === "passed").length;
    const needsReview = run.items.filter((item) => item.status === "needs_review" || item.status === "warning").length;
    const failed = run.items.filter((item) => item.status === "failed").length;
    const retrying = run.items.filter((item) => item.status === "retrying" || item.status === "queued" || item.status === "running").length;
    const scored = run.items.filter((item) => item.score !== null);
    const totalCost = await prisma.trace.aggregate({ where: { workspaceId: run.workspaceId, runItem: { runId } }, _sum: { totalCost: true } });
    const averageScore =
      scored.length > 0 ? scored.reduce((sum, item) => sum + Number(item.score ?? 0), 0) / scored.length : null;
    const status: RunStatus =
      retrying > 0
        ? "retrying"
        : failed > 0 && (passed > 0 || needsReview > 0)
          ? "partially_failed"
          : failed > 0
            ? "failed"
            : needsReview > 0
              ? "needs_review"
              : "completed";

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.run.update({
        where: { id: runId },
        data: {
          status,
          passedCases: passed,
          failedCases: failed,
          averageScore,
          totalCost: Number(totalCost._sum.totalCost ?? 0),
          completedAt: retrying > 0 ? null : new Date()
        }
      });

      if (run.status !== status) {
        await tx.runStatusEvent.create({
          data: {
            workspaceId: run.workspaceId,
            runId,
            fromStatus: run.status,
            toStatus: status,
            reason: "Run finalized from item state",
            metadataJson: { passed, needsReview, failed, retrying } as Prisma.InputJsonValue
          }
        });

        await new EventService(tx).emitRaw({
          workspaceId: run.workspaceId,
          actorUserId: run.createdBy,
          entityType: "run",
          entityId: runId,
          action: status === "failed" ? "run_failed" : status === "needs_review" ? "review_requested" : "run_completed",
          payload: { passed, needsReview, failed, retrying, averageScore, totalCost: Number(totalCost._sum.totalCost ?? 0) }
        });
      }

      return result;
    }, executionTransactionOptions);

    return { status: updated.status, averageScore: Number(updated.averageScore ?? 0), totalCost: Number(updated.totalCost) };
  }

  private async failRunFromJob(workspaceId: string, runId: string, error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown run failure";
    const run = await prisma.run.findFirst({ where: { id: runId, workspaceId } });
    if (!run || run.status === "cancelled") return;
    await prisma.run.update({ where: { id: runId }, data: { status: "failed", completedAt: new Date() } });
    await this.events.emitRaw({
      workspaceId,
      actorUserId: run.createdBy,
      entityType: "run",
      entityId: runId,
      action: "run_failed",
      payload: { error: message }
    });
  }
}

function stringifyVariables(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]));
}

function isTransientProviderError(error: unknown) {
  if (error instanceof AIProviderError) {
    // 429 (Rate Limit), 408 (Timeout), 502/503/504 (Server issues) are transient
    return error.status === 408 || error.status === 429 || (error.status && error.status >= 500);
  }
  // Network errors are often transient
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("econnreset") || message.includes("etimedout") || message.includes("network error") || message.includes("fetch failed");
}

function retryDelayMs(error: unknown, retryCount: number) {
  if (error instanceof AIProviderError && error.retryAfterMs) {
    return error.retryAfterMs;
  }
  return Math.min(60_000, 1000 * 2 ** retryCount);
}

function traceStatusFromRunItemStatus(status: RunItemStatus): RunStatus {
  if (status === "passed") return "completed";
  if (status === "failed") return "failed";
  if (status === "needs_review" || status === "warning") return "needs_review";
  if (status === "retrying") return "retrying";
  if (status === "cancelled") return "cancelled";
  if (status === "queued") return "queued";
  return "running";
}
