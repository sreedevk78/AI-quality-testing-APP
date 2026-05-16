import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/server/api";
import { assertCanWrite, getRequestContext, RequestContextError } from "@/server/context";
import { AuditService } from "@/server/services/audit-service";

const audit = new AuditService();

const approvalSchema = z.object({
  promptVersionId: z.string().uuid(),
  runId: z.string().uuid().optional(),
  comparisonReportId: z.string().uuid().optional(),
  notes: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const input = approvalSchema.parse(await request.json());
    const promptVersion = await prisma.promptVersion.findFirst({
      where: { id: input.promptVersionId, workspaceId: context.workspaceId },
      select: { id: true, projectId: true }
    });

    if (!promptVersion) {
      throw new RequestContextError("Prompt version was not found in this workspace.", 404);
    }

    if (input.comparisonReportId) {
      const report = await prisma.comparisonReport.findFirstOrThrow({
        where: { id: input.comparisonReportId, workspaceId: context.workspaceId },
        include: { candidateRun: { select: { promptVersionId: true } } }
      });
      if (report.passFailStatus !== "pass") {
        throw new RequestContextError("Release gate is blocked because comparison thresholds failed.", 409);
      }
      if (report.candidateRun?.promptVersionId !== promptVersion.id) {
        throw new RequestContextError("Release approval must target the comparison candidate prompt version.", 409);
      }
    }

    if (input.runId) {
      const run = await prisma.run.findFirst({
        where: { id: input.runId, workspaceId: context.workspaceId, promptVersionId: input.promptVersionId },
        select: { id: true }
      });
      if (!run) {
        throw new RequestContextError("Release run was not found for the selected prompt version.", 404);
      }
    }

    const approval = await prisma.$transaction(async (tx) => {
      await tx.promptVersion.update({
        where: { id: input.promptVersionId },
        data: { status: "approved" }
      });

      return tx.releaseApproval.create({
        data: {
          workspaceId: context.workspaceId,
          promptVersionId: input.promptVersionId,
          runId: input.runId,
          comparisonReportId: input.comparisonReportId,
          approvedBy: context.userId,
          notes: input.notes
        }
      });
    });

    await audit.log(context, {
      entityType: "release_approval",
      entityId: approval.id,
      action: "release.approved",
      after: approval
    });

    return apiOk(approval, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
