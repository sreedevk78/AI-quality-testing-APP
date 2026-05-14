import { prisma } from "@/lib/prisma";
import type { RequestContext } from "@/server/context";

export class TraceService {
  getTrace(context: RequestContext, traceId: string) {
    return prisma.trace.findFirst({
      where: { id: traceId, workspaceId: context.workspaceId },
      include: {
        spans: { orderBy: { createdAt: "asc" } },
        graderResults: true,
        runItem: {
          include: {
            modelCalls: { orderBy: { createdAt: "asc" } },
            datasetCase: true
          }
        }
      }
    });
  }
}
