import { apiError, apiOk } from "@/server/api";
import { assertCanWrite, getRequestContext } from "@/server/context";
import { AuditService } from "@/server/services/audit-service";
import { PromptService } from "@/server/services/prompt-service";

const prompts = new PromptService();
const audit = new AuditService();

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    return apiOk(await prompts.listVersions(context));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const created = await prompts.createVersion(context, await request.json());
    await audit.log(context, {
      entityType: "prompt_version",
      entityId: created.id,
      action: "prompt.version.created",
      after: created
    });
    return apiOk(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
