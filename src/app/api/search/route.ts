import { apiError, apiOk } from "@/server/api";
import { getRequestContext } from "@/server/context";
import { SearchService } from "@/server/services/search-service";

const search = new SearchService();

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const url = new URL(request.url);
    return apiOk(await search.global(context, url.searchParams.get("q") ?? ""));
  } catch (error) {
    return apiError(error);
  }
}
