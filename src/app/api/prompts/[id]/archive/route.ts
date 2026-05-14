import { apiError, apiOk } from "@/server/api";
import { assertCanWrite, getRequestContext } from "@/server/context";
import { PromptService } from "@/server/services/prompt-service";

const prompts = new PromptService();

export async function POST(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const { id } = await routeContext.params;
    return apiOk(await prompts.archive(context, id));
  } catch (error) {
    return apiError(error);
  }
}
