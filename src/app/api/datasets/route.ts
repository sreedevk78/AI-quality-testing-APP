import { z } from "zod";
import { apiError, apiOk } from "@/server/api";
import { assertCanWrite, getRequestContext } from "@/server/context";
import { AuditService } from "@/server/services/audit-service";
import { DatasetService } from "@/server/services/dataset-service";

const datasets = new DatasetService();
const audit = new AuditService();

const createDatasetSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  projectId: z.string().uuid().optional(),
  tags: z.array(z.string()).default([])
});

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    return apiOk(await datasets.list(context));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const created = await datasets.create(context, createDatasetSchema.parse(await request.json()));
    await audit.log(context, {
      entityType: "dataset",
      entityId: created.id,
      action: "dataset.created",
      after: created
    });
    return apiOk(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
