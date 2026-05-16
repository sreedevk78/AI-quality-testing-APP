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
    const maxBytes = Number(process.env.DATASET_IMPORT_MAX_BYTES ?? 2_000_000);
    if (Buffer.byteLength(input.csv, "utf8") > maxBytes) {
      throw new RequestContextError(`CSV import is too large. Limit imports to ${Math.round(maxBytes / 1024 / 1024)}MB.`, 413);
    }

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
    const BATCH_SIZE = 500;
    let imported = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      await prisma.datasetCase.createMany({
        data: chunk.map((row) => ({
          workspaceId: context.workspaceId,
          datasetId: input.datasetId,
          inputPayloadJson: { 
            message: row.input ?? row.message ?? row.prompt ?? row.query ?? row.text ?? "" 
          } as Prisma.InputJsonValue,
          expectedOutputJson: { 
            expected: row.expected ?? row.expected_output ?? row.answer ?? row.output ?? "" 
          } as Prisma.InputJsonValue,
          rubricJson: { 
            rubric: row.rubric ?? row.criteria ?? "" 
          } as Prisma.InputJsonValue,
          tags: row.tags ? row.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
          difficulty: normalizeDifficulty(row.difficulty),
          sourceReference: row.source_reference ?? row.id ?? row.ref,
          createdBy: context.userId
        }))
      });
      imported += chunk.length;
    }

    return { imported };
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

  async exportDataset(context: RequestContext, datasetId: string) {
    const dataset = await prisma.dataset.findFirstOrThrow({
      where: { id: datasetId, workspaceId: context.workspaceId },
      include: {
        cases: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    return {
      exportedAt: new Date().toISOString(),
      dataset: {
        id: dataset.id,
        name: dataset.name,
        description: dataset.description,
        status: dataset.status,
        versionNumber: dataset.versionNumber,
        tags: dataset.tags
      },
      cases: dataset.cases.map((item) => ({
        id: item.id,
        inputPayload: item.inputPayloadJson,
        expectedOutput: item.expectedOutputJson,
        rubric: item.rubricJson,
        tags: item.tags,
        difficulty: item.difficulty,
        sourceReference: item.sourceReference,
        isActive: item.isActive
      }))
    };
  }

  async snapshot(context: RequestContext, datasetId: string) {
    const source = await prisma.dataset.findFirstOrThrow({
      where: { id: datasetId, workspaceId: context.workspaceId },
      include: { cases: { where: { isActive: true } } }
    });

    const nextVersion = (source.versionNumber ?? 1) + 1;

    return prisma.$transaction(async (tx) => {
      // Mark current active as archived if needed, or just create new one
      const copy = await tx.dataset.create({
        data: {
          workspaceId: context.workspaceId,
          projectId: source.projectId,
          name: source.name,
          description: source.description,
          status: "active",
          versionNumber: nextVersion,
          tags: source.tags,
          createdBy: context.userId
        }
      });

      if (source.cases.length > 0) {
        const BATCH_SIZE = 500;
        for (let i = 0; i < source.cases.length; i += BATCH_SIZE) {
          const chunk = source.cases.slice(i, i + BATCH_SIZE);
          await tx.datasetCase.createMany({
            data: chunk.map((c) => ({
              workspaceId: context.workspaceId,
              datasetId: copy.id,
              inputPayloadJson: c.inputPayloadJson as Prisma.InputJsonValue,
              expectedOutputJson: c.expectedOutputJson as Prisma.InputJsonValue,
              rubricJson: c.rubricJson as Prisma.InputJsonValue,
              tags: c.tags,
              difficulty: c.difficulty,
              sourceReference: c.sourceReference,
              createdBy: context.userId
            }))
          });
        }
      }

      return copy;
    });
  }
}

function normalizeDifficulty(value: string | undefined) {
  const normalized = value?.toLowerCase().trim();
  return normalized === "easy" || normalized === "medium" || normalized === "hard" ? normalized : "medium";
}
