import { apiError, apiOk } from "@/server/api";
import { getRequestContext } from "@/server/context";
import { EventService } from "@/server/services/event-service";

const events = new EventService();

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const url = new URL(request.url);
    const requestedTake = Number(url.searchParams.get("take") ?? 100);
    return apiOk(
      await events.list(context, {
        query: url.searchParams.get("q") ?? undefined,
        take: Number.isFinite(requestedTake) ? Math.min(Math.max(requestedTake, 1), 250) : 100
      })
    );
  } catch (error) {
    return apiError(error);
  }
}
