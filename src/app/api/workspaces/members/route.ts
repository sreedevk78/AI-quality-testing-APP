import { z } from "zod";
import { apiError, apiOk } from "@/server/api";
import { assertCanAdminWorkspace, getRequestContext } from "@/server/context";
import { WorkspaceService } from "@/server/services/workspace-service";

const workspaces = new WorkspaceService();
const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "editor", "reviewer", "viewer"])
});

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    assertCanAdminWorkspace(context);
    return apiOk(await workspaces.inviteMember(context, inviteSchema.parse(await request.json())), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
