import { apiError, apiOk } from "@/server/api";
import { assertCanWrite, getRequestContext } from "@/server/context";
import { AuditService } from "@/server/services/audit-service";
import { RunService } from "@/server/services/run-service";

const runs = new RunService();
const audit = new AuditService();

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const created = await runs.createRun(context, await request.json());
    await audit.log(context, {
      entityType: "run",
      entityId: created.id,
      action: "run.created",
      after: created
    });
    return apiOk(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
