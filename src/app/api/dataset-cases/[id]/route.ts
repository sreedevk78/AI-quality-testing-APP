import { z } from "zod";
import { apiError, apiOk } from "@/server/api";
import { assertCanWrite, getRequestContext } from "@/server/context";
import { DatasetService } from "@/server/services/dataset-service";

const datasets = new DatasetService();
const caseUpdateSchema = z.object({
  inputPayloadJson: z.record(z.unknown()).optional(),
  expectedOutputJson: z.record(z.unknown()).optional(),
  rubricJson: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  difficulty: z.string().optional(),
  isActive: z.boolean().optional()
});

export async function PATCH(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const { id } = await routeContext.params;
    return apiOk(await datasets.updateCase(context, id, caseUpdateSchema.parse(await request.json())));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const { id } = await routeContext.params;
    return apiOk(await datasets.deactivateCase(context, id));
  } catch (error) {
    return apiError(error);
  }
}
