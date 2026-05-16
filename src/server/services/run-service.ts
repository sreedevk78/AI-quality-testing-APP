import { Prisma } from "@prisma/client";
import { getProvider } from "@/lib/ai";
import type { AIRequest } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";
import { runBuilderSchema } from "@/lib/validation";
import type { RequestContext } from "@/server/context";
import { RequestContextError } from "@/server/context";
import { BillingService } from "@/server/services/billing-service";
import { EventService } from "@/server/services/event-service";
import { JobService } from "@/server/services/job-service";

export class RunService {
  private readonly billing = new BillingService();
  private readonly events = new EventService();
  private readonly jobs = new JobService();

  async executeModelCall(request: AIRequest) {
    const provider = getProvider(request.provider);
    return provider.generate(request);
  }

  buildRunItems(datasetCaseIds: string[]) {
    return datasetCaseIds.map((datasetCaseId) => ({
      datasetCaseId,
      status: "queued" as const,
      retryCount: 0
    }));
  }

  async createRun(context: RequestContext, rawInput: unknown) {
    const input = runBuilderSchema.parse(rawInput);
    const promptVersion = await prisma.promptVersion.findFirst({
      where: {
        id: input.promptVersionId,
        workspaceId: context.workspaceId
      },
      select: { id: true, projectId: true, systemPrompt: true, userPromptTemplate: true }
    });

    if (!promptVersion) {
      throw new RequestContextError("Prompt version was not found in this workspace.", 404);
    }

    const dataset = await prisma.dataset.findFirst({
      where: {
        id: input.datasetId,
        workspaceId: context.workspaceId,
        projectId: promptVersion.projectId
      },
      select: { id: true }
    });

    if (!dataset) {
      throw new RequestContextError("Dataset was not found for the selected prompt project.", 404);
    }

    const cases = await prisma.datasetCase.findMany({
      where: {
        workspaceId: context.workspaceId,
        datasetId: input.datasetId,
        isActive: true
      },
      orderBy: { createdAt: "asc" }
    });

    if (cases.length === 0) {
      throw new RequestContextError("Dataset has no active cases to run.", 422);
    }

    await this.billing.assertRunBudget(context, {
      requestedCases: cases.length,
      estimatedCost: estimateRunCost(input.provider, input.modelName, promptVersion, cases)
    });

    return prisma.$transaction(async (tx) => {
      const run = await tx.run.create({
        data: {
          workspaceId: context.workspaceId,
          projectId: promptVersion.projectId,
          promptVersionId: input.promptVersionId,
          datasetId: input.datasetId,
          provider: input.provider,
          modelName: input.modelName,
          modelParamsJson: {
            temperature: input.temperature,
            graderDefinitionId: input.graderDefinitionId
          } as Prisma.InputJsonValue,
          status: "queued",
          totalCases: cases.length,
          createdBy: context.userId
        }
      });

      await tx.runStatusEvent.create({
        data: {
          workspaceId: context.workspaceId,
          runId: run.id,
          toStatus: "queued",
          reason: "Run created"
        }
      });

      await tx.runItem.createMany({
        data: cases.map((datasetCase) => ({
          workspaceId: context.workspaceId,
          runId: run.id,
          datasetCaseId: datasetCase.id,
          status: "queued",
          inputSnapshotJson: (datasetCase.inputPayloadJson ?? {}) as Prisma.InputJsonValue
        }))
      });

      await tx.backgroundJob.upsert({
        where: { idempotencyKey: `evaluate_run:${run.id}` },
        update: {
          status: "queued",
          payloadJson: { runId: run.id },
          errorMessage: null,
          runAfter: new Date(),
          lockedAt: null,
          lockedBy: null,
          completedAt: null
        },
        create: {
          workspaceId: context.workspaceId,
          jobType: "evaluate_run",
          payloadJson: { runId: run.id },
          status: "queued",
          idempotencyKey: `evaluate_run:${run.id}`
        }
      });

      await new EventService(tx).emit(context, {
        entityType: "run",
        entityId: run.id,
        action: "run_created",
        payload: {
          promptVersionId: input.promptVersionId,
          datasetId: input.datasetId,
          provider: input.provider,
          modelName: input.modelName,
          totalCases: cases.length
        }
      });

      return tx.run.findUniqueOrThrow({
        where: { id: run.id },
        include: { items: true }
      });
    });
  }

  async retryFailed(context: RequestContext, runId: string) {
    const run = await prisma.run.findFirst({
      where: { id: runId, workspaceId: context.workspaceId },
      select: { id: true, status: true }
    });

    if (!run) {
      throw new RequestContextError("Run was not found in this workspace.", 404);
    }

    await prisma.$transaction(async (tx) => {
      const updatedItems = await tx.runItem.updateMany({
        where: {
          workspaceId: context.workspaceId,
          runId,
          status: { in: ["failed", "warning", "needs_review"] },
          reviews: {
            none: {}
          }
        },
        data: { status: "retrying", errorMessage: null, completedAt: null }
      });

      if (updatedItems.count === 0) {
        throw new RequestContextError("No unreviewed failed or review-needed items are available to retry.", 409);
      }

      await tx.run.update({
        where: { id: runId },
        data: { status: "retrying", completedAt: null }
      });

      await tx.runStatusEvent.create({
        data: {
          workspaceId: context.workspaceId,
          runId,
          fromStatus: run.status,
          toStatus: "retrying",
          reason: "User retried failed run items",
          metadataJson: { updatedItems: updatedItems.count } as Prisma.InputJsonValue
        }
      });

      return updatedItems;
    });

    const job = await this.jobs.enqueue({
      workspaceId: context.workspaceId,
      jobType: "evaluate_run",
      payload: { runId, retryOnlyFailed: true } as Prisma.InputJsonValue,
      priority: 2,
      idempotencyKey: `evaluate_run:${runId}:retry`
    });

    await this.events.emit(context, {
      entityType: "run",
      entityId: runId,
      action: "run_retrying",
      payload: { jobId: job.id }
    });

    return job;
  }

  async cancel(context: RequestContext, runId: string) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.run.findFirst({
        where: { id: runId, workspaceId: context.workspaceId }
      });

      if (!current) {
        throw new RequestContextError("Run was not found in this workspace.", 404);
      }

      const run = await tx.run.update({
        where: { id: current.id },
        data: { status: "cancelled", completedAt: new Date() }
      });

      await tx.runItem.updateMany({
        where: { workspaceId: context.workspaceId, runId, status: { in: ["queued", "running", "retrying", "needs_review"] } },
        data: { status: "cancelled" }
      });

      await tx.backgroundJob.updateMany({
        where: {
          workspaceId: context.workspaceId,
          payloadJson: { path: ["runId"], equals: runId },
          status: { in: ["queued", "initializing", "running", "retrying"] }
        },
        data: {
          status: "cancelled",
          errorMessage: "Run cancelled by user",
          completedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
          lastHeartbeatAt: null
        }
      });

      await tx.runStatusEvent.create({
        data: {
          workspaceId: context.workspaceId,
          runId,
          fromStatus: current.status,
          toStatus: "cancelled",
          reason: "User cancelled run"
        }
      });

      await new EventService(tx).emit(context, {
        entityType: "run",
        entityId: runId,
        action: "run_cancelled",
        payload: { previousStatus: current.status }
      });

      return run;
    });
  }
}

function estimateRunCost(
  providerName: "gemini" | "groq" | "ollama",
  modelName: string,
  prompt: { systemPrompt: string; userPromptTemplate: string },
  cases: Array<{ inputPayloadJson: Prisma.JsonValue }>
) {
  const provider = getProvider(providerName);
  const inputTokens = cases.reduce((sum, item) => {
    const renderedSize = prompt.systemPrompt.length + prompt.userPromptTemplate.length + JSON.stringify(item.inputPayloadJson ?? {}).length;
    return sum + Math.ceil(renderedSize / 4);
  }, 0);
  const outputTokens = cases.length * Number(process.env.RUN_ESTIMATED_OUTPUT_TOKENS_PER_CASE ?? 400);
  return provider.estimateCost({ inputTokens, outputTokens, totalTokens: inputTokens + outputTokens }, modelName);
}
