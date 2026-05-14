import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/server/api";
import { getRequestContext } from "@/server/context";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const logs = await prisma.auditLog.findMany({
      where: { workspaceId: context.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return apiOk(logs);
  } catch (error) {
    return apiError(error);
  }
}
