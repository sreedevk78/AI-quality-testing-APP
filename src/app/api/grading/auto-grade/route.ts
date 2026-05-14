import { z } from "zod";
import { apiError, apiOk } from "@/server/api";
import { assertCanReview, getRequestContext } from "@/server/context";
import { GradingService } from "@/server/services/grading-service";

const grading = new GradingService();
const autoGradeSchema = z.object({
  runItemId: z.string().uuid(),
  graderDefinitionId: z.string().uuid()
});

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    assertCanReview(context);
    return apiOk(await grading.autoGrade(context, autoGradeSchema.parse(await request.json())), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
