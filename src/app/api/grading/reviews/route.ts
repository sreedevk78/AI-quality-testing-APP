import { z } from "zod";
import { apiError, apiOk } from "@/server/api";
import { assertCanReview, getRequestContext } from "@/server/context";
import { AuditService } from "@/server/services/audit-service";
import { GradingService } from "@/server/services/grading-service";

const grading = new GradingService();
const audit = new AuditService();

const reviewSchema = z.object({
  runItemId: z.string().uuid(),
  verdict: z.enum(["approved", "needs_fix", "rejected"]),
  score: z.number().min(0).max(1).optional(),
  notes: z.string().optional()
});

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    assertCanReview(context);
    return apiOk(await grading.queue(context));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    assertCanReview(context);
    const created = await grading.submitReview(context, reviewSchema.parse(await request.json()));
    await audit.log(context, {
      entityType: "human_review",
      entityId: created.id,
      action: "review.submitted",
      after: created
    });
    return apiOk(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
