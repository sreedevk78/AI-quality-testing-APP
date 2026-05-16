import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { promptVersionSchema } from "@/lib/validation";
import { RequestContextError, type RequestContext } from "@/server/context";

export class PromptService {
  listVersions(context: RequestContext) {
    return prisma.promptVersion.findMany({
      where: { workspaceId: context.workspaceId },
      orderBy: [{ promptKey: "asc" }, { versionNumber: "desc" }],
      take: 100
    });
  }

  getActive(context: RequestContext, promptKey: string) {
    return prisma.promptVersion.findFirst({
      where: {
        workspaceId: context.workspaceId,
        promptKey,
        status: "active"
      },
      orderBy: { versionNumber: "desc" }
    });
  }

  async createVersion(context: RequestContext, rawInput: unknown) {
    const input = promptVersionSchema.parse(rawInput);
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, workspaceId: context.workspaceId },
      select: { id: true }
    });

    if (!project) {
      throw new RequestContextError("Project was not found in this workspace.", 404);
    }

    const latest = await prisma.promptVersion.findFirst({
      where: {
        workspaceId: context.workspaceId,
        projectId: input.projectId,
        promptKey: input.promptKey
      },
      orderBy: { versionNumber: "desc" }
    });

    return prisma.promptVersion.create({
      data: {
        workspaceId: context.workspaceId,
        projectId: input.projectId,
        promptKey: input.promptKey,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        title: input.title,
        systemPrompt: input.systemPrompt,
        userPromptTemplate: input.userPromptTemplate,
        variablesSchema: input.variablesSchema as Prisma.InputJsonValue,
        provider: input.provider,
        modelName: input.modelName,
        modelParamsJson: input.modelParams as Prisma.InputJsonValue,
        status: "draft",
        tags: input.tags,
        createdBy: context.userId
      }
    });
  }

  async publish(context: RequestContext, promptVersionId: string) {
    const version = await prisma.promptVersion.findFirstOrThrow({
      where: { id: promptVersionId, workspaceId: context.workspaceId }
    });

    await prisma.promptVersion.updateMany({
      where: {
        workspaceId: context.workspaceId,
        projectId: version.projectId,
        promptKey: version.promptKey,
        status: "active"
      },
      data: { status: "archived" }
    });

    return prisma.promptVersion.update({
      where: { id: promptVersionId },
      data: { status: "active" }
    });
  }

  async archive(context: RequestContext, promptVersionId: string) {
    return prisma.promptVersion.update({
      where: { id: promptVersionId, workspaceId: context.workspaceId },
      data: { status: "archived" }
    });
  }

  async rollback(context: RequestContext, promptVersionId: string) {
    const source = await prisma.promptVersion.findFirstOrThrow({
      where: { id: promptVersionId, workspaceId: context.workspaceId }
    });

    const latest = await prisma.promptVersion.findFirst({
      where: {
        workspaceId: context.workspaceId,
        projectId: source.projectId,
        promptKey: source.promptKey
      },
      orderBy: { versionNumber: "desc" }
    });

    return prisma.promptVersion.create({
      data: {
        workspaceId: source.workspaceId,
        projectId: source.projectId,
        promptKey: source.promptKey,
        versionNumber: (latest?.versionNumber ?? source.versionNumber) + 1,
        title: `${source.title} rollback`,
        systemPrompt: source.systemPrompt,
        userPromptTemplate: source.userPromptTemplate,
        variablesSchema: source.variablesSchema as Prisma.InputJsonValue,
        provider: source.provider,
        modelName: source.modelName,
        modelParamsJson: source.modelParamsJson as Prisma.InputJsonValue,
        status: "draft",
        tags: source.tags,
        changelog: `Rollback copy from v${source.versionNumber}`,
        createdBy: context.userId
      }
    });
  }

  async compare(context: RequestContext, baselineId: string, candidateId: string) {
    const [baseline, candidate] = await Promise.all([
      prisma.promptVersion.findFirstOrThrow({ where: { id: baselineId, workspaceId: context.workspaceId } }),
      prisma.promptVersion.findFirstOrThrow({ where: { id: candidateId, workspaceId: context.workspaceId } })
    ]);

    return {
      baseline: {
        id: baseline.id,
        version: baseline.versionNumber,
        systemPrompt: baseline.systemPrompt,
        userPromptTemplate: baseline.userPromptTemplate
      },
      candidate: {
        id: candidate.id,
        version: candidate.versionNumber,
        systemPrompt: candidate.systemPrompt,
        userPromptTemplate: candidate.userPromptTemplate
      },
      changed: {
        systemPrompt: baseline.systemPrompt !== candidate.systemPrompt,
        userPromptTemplate: baseline.userPromptTemplate !== candidate.userPromptTemplate,
        modelName: baseline.modelName !== candidate.modelName
      }
    };
  }

  render(template: string, variables: Record<string, string>) {
    return Object.entries(variables).reduce(
      (rendered, [key, value]) => rendered.replaceAll(`{{${key}}}`, value),
      template
    );
  }
}
