import { EventService } from "@/server/services/event-service";
import { apiError } from "@/server/api";
import { getRequestContext } from "@/server/context";
import { DatasetService } from "@/server/services/dataset-service";

const datasets = new DatasetService();
const events = new EventService();

export async function GET(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const { id } = await routeContext.params;
    const exported = await datasets.exportDataset(context, id);
    await events.emit(context, {
      entityType: "dataset",
      entityId: id,
      action: "export_created",
      payload: { caseCount: exported.cases.length, format: "json" }
    });

    return new Response(JSON.stringify(exported, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="dataset-${id}.json"`
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
