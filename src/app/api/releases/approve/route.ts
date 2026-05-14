import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/server/api";
import { assertCanWrite, getRequestContext } from "@/server/context";
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

    if (input.comparisonReportId) {
      const report = await prisma.comparisonReport.findFirstOrThrow({
        where: { id: input.comparisonReportId, workspaceId: context.workspaceId }
      });
      if (report.passFailStatus !== "pass") {
        return apiError(new Error("Release gate is blocked because comparison thresholds failed."), 409);
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
