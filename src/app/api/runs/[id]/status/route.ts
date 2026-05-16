import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/server/api";
import { getRequestContext } from "@/server/context";

export async function GET(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const { id } = await routeContext.params;
    const [run, jobs, events] = await Promise.all([
      prisma.run.findFirst({
        where: { id, workspaceId: context.workspaceId },
        include: {
          items: {
            select: { id: true, status: true, retryCount: true, score: true, errorMessage: true, updatedAt: true },
            orderBy: { createdAt: "asc" }
          },
          statusEvents: { orderBy: { createdAt: "asc" } }
        }
      }),
      prisma.backgroundJob.findMany({
        where: {
          workspaceId: context.workspaceId,
          jobType: "evaluate_run",
          payloadJson: { path: ["runId"], equals: id }
        },
        orderBy: { createdAt: "desc" },
        take: 10
      }),
      prisma.systemEvent.findMany({
        where: { workspaceId: context.workspaceId, entityId: id },
        orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
        take: 100
      })
    ]);

    if (!run) {
      return apiError(new Error("Run not found"), 404);
    }

    return apiOk({ run, jobs, events });
  } catch (error) {
    return apiError(error);
  }
}
