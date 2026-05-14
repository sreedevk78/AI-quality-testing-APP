import { apiError, apiOk } from "@/server/api";
import { assertCanWrite, getRequestContext } from "@/server/context";
import { RunService } from "@/server/services/run-service";

const runs = new RunService();

export async function POST(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const { id } = await routeContext.params;
    return apiOk(await runs.retryFailed(context, id));
  } catch (error) {
    return apiError(error);
  }
}
