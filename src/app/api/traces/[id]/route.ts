import { apiError, apiOk } from "@/server/api";
import { getRequestContext } from "@/server/context";
import { TraceService } from "@/server/services/trace-service";

const traces = new TraceService();

export async function GET(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const { id } = await routeContext.params;
    const trace = await traces.getTrace(context, id);
    if (!trace) {
      return apiError(new Error("Trace not found"), 404);
    }
    return apiOk(trace);
  } catch (error) {
    return apiError(error);
  }
}
