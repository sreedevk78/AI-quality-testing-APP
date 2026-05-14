import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/ai";
import type { RequestContext } from "@/server/context";

export class GradingService {
  queue(context: RequestContext) {
    return prisma.runItem.findMany({
      where: {
        workspaceId: context.workspaceId,
        OR: [{ status: "warning" }, { status: "failed" }]
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

  submitReview(
    context: RequestContext,
    input: { runItemId: string; verdict: string; score?: number; notes?: string }
  ) {
    return prisma.humanReview.create({
      data: {
        workspaceId: context.workspaceId,
        runItemId: input.runItemId,
        reviewerUserId: context.userId,
        verdict: input.verdict,
        score: input.score,
        notes: input.notes,
        reviewedAt: new Date()
      }
    });
  }

  getDefinitions(context: RequestContext) {
    return prisma.graderDefinition.findMany({
      where: { workspaceId: context.workspaceId },
      orderBy: { createdAt: "desc" }
    });
  }

  createDefinition(
    context: RequestContext,
    input: { name: string; description?: string; type: string; provider: string; modelName: string; promptTemplate: string }
  ) {
    return prisma.graderDefinition.create({
      data: {
        workspaceId: context.workspaceId,
        name: input.name,
        description: input.description,
        type: input.type,
        provider: input.provider as any,
        modelName: input.modelName,
        promptTemplate: input.promptTemplate,
        rubricJson: {},
        createdBy: context.userId
      }
    });
  }

  deleteDefinition(context: RequestContext, id: string) {
    return prisma.graderDefinition.delete({
      where: { id, workspaceId: context.workspaceId }
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

    const provider = getProvider(grader.provider as any);
    const result = await provider.generateStructured<{ score: number; label: string; rationale: string }>({
      provider: grader.provider as any,
      model: grader.modelName,
      temperature: 0,
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
            expected: item.datasetCase.expectedOutputJson,
            rubric: item.datasetCase.rubricJson
          })
        }
      ]
    });

    if (!item.trace) {
      throw new Error("Run item must have a trace before automated grading.");
    }

    return prisma.graderResult.create({
      data: {
        workspaceId: context.workspaceId,
        traceId: item.trace.id,
        graderDefinitionId: grader.id,
        score: result.json.score,
        label: result.json.label,
        rationale: result.json.rationale,
        metadataJson: {
          provider: result.provider,
          model: result.model,
          usage: result.usage,
          latencyMs: result.latencyMs,
          costEstimate: result.costEstimate
        }
      }
    });
  }
}
