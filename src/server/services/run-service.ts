import { Prisma } from "@prisma/client";
import { getProvider } from "@/lib/ai";
import type { AIRequest } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";
import { runBuilderSchema } from "@/lib/validation";
import type { RequestContext } from "@/server/context";
import { RequestContextError } from "@/server/context";
import { BillingService } from "@/server/services/billing-service";

export class RunService {
  private readonly billing = new BillingService();

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
      select: { id: true, projectId: true }
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

    await this.billing.assertRunQuota(context, cases.length);

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

      await tx.backgroundJob.create({
        data: {
          workspaceId: context.workspaceId,
          jobType: "evaluate_run",
          payloadJson: { runId: run.id },
          status: "queued"
        }
      });

      return tx.run.findUniqueOrThrow({
        where: { id: run.id },
        include: { items: true }
      });
    });
  }

  async retryFailed(context: RequestContext, runId: string) {
    await prisma.runItem.updateMany({
      where: {
        workspaceId: context.workspaceId,
        runId,
        status: { in: ["failed", "warning"] }
      },
      data: { status: "queued", errorMessage: null }
    });

    return prisma.backgroundJob.create({
      data: {
        workspaceId: context.workspaceId,
        jobType: "evaluate_run",
        payloadJson: { runId, retryOnlyFailed: true },
        status: "queued"
      }
    });
  }

  async cancel(context: RequestContext, runId: string) {
    return prisma.$transaction(async (tx) => {
      const run = await tx.run.update({
        where: { id: runId },
        data: { status: "cancelled", completedAt: new Date() }
      });

      await tx.runItem.updateMany({
        where: { workspaceId: context.workspaceId, runId, status: { in: ["queued", "running"] } },
        data: { status: "cancelled" }
      });

      await tx.runStatusEvent.create({
        data: {
          workspaceId: context.workspaceId,
          runId,
          fromStatus: "running",
          toStatus: "cancelled",
          reason: "User cancelled run"
        }
      });

      return run;
    });
  }
}
