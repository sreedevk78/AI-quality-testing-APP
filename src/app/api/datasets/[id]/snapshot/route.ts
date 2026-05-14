import { apiError, apiOk } from "@/server/api";
import { assertCanWrite, getRequestContext } from "@/server/context";
import { DatasetService } from "@/server/services/dataset-service";

const datasets = new DatasetService();

export async function POST(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const { id } = await routeContext.params;
    const result = await datasets.snapshot(context, id);
    return apiOk(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
