import { Prisma } from "@prisma/client";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { datasetCaseSchema } from "@/lib/validation";
import { RequestContextError, type RequestContext } from "@/server/context";

export class DatasetService {
  list(context: RequestContext) {
    return prisma.dataset.findMany({
      where: { workspaceId: context.workspaceId },
      include: { cases: true },
      orderBy: { updatedAt: "desc" },
      take: 50
    });
  }

  async create(context: RequestContext, input: { name: string; description?: string; tags?: string[]; projectId?: string }) {
    const project = await prisma.project.findFirst({
      where: {
        workspaceId: context.workspaceId,
        ...(input.projectId ? { id: input.projectId } : {})
      },
      orderBy: { createdAt: "asc" },
      select: { id: true }
    });

    if (!project) {
      throw new RequestContextError("Create a workspace project before adding datasets.", 422);
    }

    return prisma.dataset.create({
      data: {
        workspaceId: context.workspaceId,
        projectId: project.id,
        name: input.name,
        description: input.description,
        status: "draft",
        tags: input.tags ?? [],
        createdBy: context.userId
      }
    });
  }

  update(context: RequestContext, datasetId: string, input: { name?: string; description?: string; tags?: string[]; status?: "draft" | "active" | "archived" }) {
    return prisma.dataset.update({
      where: { id: datasetId, workspaceId: context.workspaceId },
      data: input
    });
  }

  archive(context: RequestContext, datasetId: string) {
    return prisma.dataset.update({
      where: { id: datasetId, workspaceId: context.workspaceId },
      data: { status: "archived" }
    });
  }

  async addCase(context: RequestContext, rawInput: unknown) {
    const input = datasetCaseSchema.parse(rawInput);
    const dataset = await prisma.dataset.findFirst({
      where: { id: input.datasetId, workspaceId: context.workspaceId },
      select: { id: true }
    });

    if (!dataset) {
      throw new RequestContextError("Dataset was not found in this workspace.", 404);
    }

    return prisma.datasetCase.create({
      data: {
        workspaceId: context.workspaceId,
        datasetId: input.datasetId,
        inputPayloadJson: input.inputPayload as Prisma.InputJsonValue,
        expectedOutputJson: input.expectedOutput as Prisma.InputJsonValue | undefined,
        rubricJson: input.rubric as Prisma.InputJsonValue,
        tags: input.tags,
        difficulty: input.difficulty,
        createdBy: context.userId
      }
    });
  }

  async importCsv(context: RequestContext, input: { datasetId: string; csv: string }) {
    const dataset = await prisma.dataset.findFirst({
      where: { id: input.datasetId, workspaceId: context.workspaceId },
      select: { id: true }
    });

    if (!dataset) {
      throw new RequestContextError("Dataset was not found in this workspace.", 404);
    }

    const parsed = Papa.parse<Record<string, string>>(input.csv, {
      header: true,
      skipEmptyLines: true
    });

    if (parsed.errors.length) {
      throw new Error(parsed.errors[0]?.message ?? "CSV import failed");
    }

    const rows = parsed.data.filter((row) => Object.keys(row).length > 0);
    await prisma.datasetCase.createMany({
      data: rows.map((row) => ({
        workspaceId: context.workspaceId,
        datasetId: input.datasetId,
        inputPayloadJson: { message: row.input ?? row.message ?? "" } as Prisma.InputJsonValue,
        expectedOutputJson: { expected: row.expected ?? row.expected_output ?? "" } as Prisma.InputJsonValue,
        rubricJson: { rubric: row.rubric ?? "" } as Prisma.InputJsonValue,
        tags: row.tags ? row.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
        difficulty: row.difficulty ?? "medium",
        sourceReference: row.source_reference,
        createdBy: context.userId
      }))
    });

    return { imported: rows.length };
  }

  updateCase(
    context: RequestContext,
    caseId: string,
    input: { inputPayloadJson?: unknown; expectedOutputJson?: unknown; rubricJson?: unknown; tags?: string[]; difficulty?: string; isActive?: boolean }
  ) {
    return prisma.datasetCase.update({
      where: { id: caseId, workspaceId: context.workspaceId },
      data: {
        inputPayloadJson: input.inputPayloadJson as Prisma.InputJsonValue | undefined,
        expectedOutputJson: input.expectedOutputJson as Prisma.InputJsonValue | undefined,
        rubricJson: input.rubricJson as Prisma.InputJsonValue | undefined,
        tags: input.tags,
        difficulty: input.difficulty,
        isActive: input.isActive
      }
    });
  }

  deactivateCase(context: RequestContext, caseId: string) {
    return prisma.datasetCase.update({
      where: { id: caseId, workspaceId: context.workspaceId },
      data: { isActive: false }
    });
  }
}
