import { prisma } from "@/lib/prisma";
import { apiError } from "@/server/api";
import { getRequestContext } from "@/server/context";

export async function GET(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const { id } = await routeContext.params;
    const run = await prisma.run.findFirstOrThrow({
      where: { id, workspaceId: context.workspaceId },
      include: {
        items: {
          include: {
            datasetCase: true,
            trace: { include: { spans: true, graderResults: true } },
            modelCalls: true
          }
        }
      }
    });

    return new Response(JSON.stringify(run, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${id}.json"`
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
