import { z } from "zod";
import { apiError, apiOk } from "@/server/api";
import { assertCanWrite, getRequestContext } from "@/server/context";
import { DatasetService } from "@/server/services/dataset-service";

const datasets = new DatasetService();
const importSchema = z.object({
  datasetId: z.string().uuid(),
  csv: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    return apiOk(await datasets.importCsv(context, importSchema.parse(await request.json())));
  } catch (error) {
    return apiError(error);
  }
}
