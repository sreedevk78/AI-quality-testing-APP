import { apiError, apiOk } from "@/server/api";
import { assertCanWrite, getRequestContext } from "@/server/context";
import { AuditService } from "@/server/services/audit-service";
import { DatasetService } from "@/server/services/dataset-service";

const datasets = new DatasetService();
const audit = new AuditService();

export async function POST(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const { id } = await routeContext.params;
    const body = await request.json();
    const created = await datasets.addCase(context, { ...body, datasetId: id });
    await audit.log(context, {
      entityType: "dataset_case",
      entityId: created.id,
      action: "dataset.case.created",
      after: created
    });
    return apiOk(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
