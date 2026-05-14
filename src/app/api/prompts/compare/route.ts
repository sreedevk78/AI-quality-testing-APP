import { apiError, apiOk } from "@/server/api";
import { getRequestContext } from "@/server/context";
import { PromptService } from "@/server/services/prompt-service";

const prompts = new PromptService();

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const url = new URL(request.url);
    const baselineId = url.searchParams.get("baselineId");
    const candidateId = url.searchParams.get("candidateId");
    if (!baselineId || !candidateId) {
      return apiError(new Error("baselineId and candidateId are required"), 400);
    }
    return apiOk(await prompts.compare(context, baselineId, candidateId));
  } catch (error) {
    return apiError(error);
  }
}
