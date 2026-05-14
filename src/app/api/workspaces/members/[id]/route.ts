import { z } from "zod";
import { apiError, apiOk } from "@/server/api";
import { assertCanWrite, getRequestContext } from "@/server/context";
import { WorkspaceService } from "@/server/services/workspace-service";

const workspaces = new WorkspaceService();
const roleSchema = z.object({
  role: z.enum(["admin", "editor", "reviewer", "viewer"])
});

export async function PATCH(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const { id } = await routeContext.params;
    const { role } = roleSchema.parse(await request.json());
    return apiOk(await workspaces.updateMemberRole(context, id, role));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    assertCanWrite(context);
    const { id } = await routeContext.params;
    return apiOk(await workspaces.removeMember(context, id));
  } catch (error) {
    return apiError(error);
  }
}
