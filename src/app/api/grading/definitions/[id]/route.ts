import { apiError, apiOk } from "@/server/api";
import { assertCanWrite, getRequestContext } from "@/server/context";
import { GradingService } from "@/server/services/grading-service";

const grading = new GradingService();

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const { id } = await routeContext.params;
    await grading.deleteDefinition(context, id);
    return apiOk({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
