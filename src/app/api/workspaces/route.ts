import { z } from "zod";
import { apiError, apiOk } from "@/server/api";
import { getRequestContext } from "@/server/context";
import { WorkspaceService } from "@/server/services/workspace-service";

const workspaces = new WorkspaceService();
const workspaceSchema = z.object({
  name: z.string().min(2),
  role: z.string().optional(),
  inviteEmail: z.string().email().optional()
});

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    return apiOk(await workspaces.listForUser(context));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const created = await workspaces.createForUser(context, workspaceSchema.parse(await request.json()));
    return apiOk(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
