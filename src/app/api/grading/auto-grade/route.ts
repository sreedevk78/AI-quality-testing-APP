import { z } from "zod";
import { apiError, apiOk } from "@/server/api";
import { assertCanReview, getRequestContext } from "@/server/context";
import { GradingService } from "@/server/services/grading-service";

const grading = new GradingService();
const autoGradeSchema = z.object({
  runId: z.string().uuid().optional(),
  runItemId: z.string().uuid().optional(),
  graderDefinitionId: z.string().uuid().optional()
}).refine((input) => input.runId || (input.runItemId && input.graderDefinitionId), {
  message: "runId or runItemId with graderDefinitionId is required"
});

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    assertCanReview(context);
    const input = autoGradeSchema.parse(await request.json());
    if (input.runId) {
      return apiOk(await grading.autoGradeRun(context, { runId: input.runId, graderDefinitionId: input.graderDefinitionId }), { status: 201 });
    }
    return apiOk(await grading.autoGrade(context, { runItemId: input.runItemId!, graderDefinitionId: input.graderDefinitionId! }), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
