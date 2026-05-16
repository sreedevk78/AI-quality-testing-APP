import { apiError, apiOk } from "@/server/api";
import { getRequestContext } from "@/server/context";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getRequestContext(request);
    const { id } = await routeContext.params;

    const run = await prisma.run.findUnique({
      where: { id, workspaceId: auth.workspaceId },
      select: { status: true, passedCases: true, failedCases: true, averageScore: true }
    });

    if (!run) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }

    return apiOk(run);
  } catch (error) {
    return apiError(error);
  }
}
