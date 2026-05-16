import { apiError, apiOk } from "@/server/api";
import { assertCanAdminWorkspace, getRequestContext } from "@/server/context";
import { ProviderCredentialService } from "@/server/services/provider-credential-service";

const credentials = new ProviderCredentialService();

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    assertCanAdminWorkspace(context);
    const { id } = await routeContext.params;
    return apiOk(await credentials.revoke(context, id));
  } catch (error) {
    return apiError(error);
  }
}
