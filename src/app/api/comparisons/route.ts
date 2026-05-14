import { z } from "zod";
import { apiError, apiOk } from "@/server/api";
import { assertCanWrite, getRequestContext } from "@/server/context";
import { AuditService } from "@/server/services/audit-service";
import { ComparisonService } from "@/server/services/comparison-service";

const comparisons = new ComparisonService();
const audit = new AuditService();

const comparisonSchema = z.object({
  baselineRunId: z.string().uuid(),
  candidateRunId: z.string().uuid(),
  threshold: z.number().min(0).max(1).default(0.85)
});

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const created = await comparisons.createReport(context, comparisonSchema.parse(await request.json()));
    await audit.log(context, {
      entityType: "comparison_report",
      entityId: created.id,
      action: "comparison.created",
      after: created
    });
    return apiOk(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
