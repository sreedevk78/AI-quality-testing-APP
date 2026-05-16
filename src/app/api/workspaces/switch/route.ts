import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/server/api";
import { getRequestContext, RequestContextError } from "@/server/context";
import { EventService } from "@/server/services/event-service";

const switchSchema = z.object({
  workspaceId: z.string().uuid()
});

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const { workspaceId } = switchSchema.parse(await request.json());
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: context.userId },
      include: { workspace: { select: { name: true } } }
    });

    if (!membership) {
      throw new RequestContextError("Workspace was not found for this user.", 404);
    }

    const cookieStore = await cookies();
    cookieStore.set("workspace_id", workspaceId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365
    });

    await new EventService().emitRaw({
      workspaceId,
      actorUserId: context.userId,
      entityType: "workspace",
      entityId: workspaceId,
      action: "workspace_switched",
      payload: { workspaceName: membership.workspace.name }
    });

    return apiOk({ switched: true, workspaceId, workspaceName: membership.workspace.name });
  } catch (error) {
    return apiError(error);
  }
}
