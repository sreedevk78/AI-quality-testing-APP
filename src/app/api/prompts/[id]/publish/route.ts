import { apiError, apiOk } from "@/server/api";
import { assertCanWrite, getRequestContext } from "@/server/context";
import { AuditService } from "@/server/services/audit-service";
import { PromptService } from "@/server/services/prompt-service";

const prompts = new PromptService();
const audit = new AuditService();

export async function POST(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const { id } = await routeContext.params;
    const published = await prompts.publish(context, id);
    await audit.log(context, {
      entityType: "prompt_version",
      entityId: published.id,
      action: "prompt.version.published",
      after: published
    });
    return apiOk(published);
  } catch (error) {
    return apiError(error);
  }
}
