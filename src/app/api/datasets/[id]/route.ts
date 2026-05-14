import { z } from "zod";
import { apiError, apiOk } from "@/server/api";
import { assertCanWrite, getRequestContext } from "@/server/context";
import { DatasetService } from "@/server/services/dataset-service";

const datasets = new DatasetService();
const datasetUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["draft", "active", "archived"]).optional()
});

export async function PATCH(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const { id } = await routeContext.params;
    return apiOk(await datasets.update(context, id, datasetUpdateSchema.parse(await request.json())));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const { id } = await routeContext.params;
    return apiOk(await datasets.archive(context, id));
  } catch (error) {
    return apiError(error);
  }
}
