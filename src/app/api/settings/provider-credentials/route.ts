import { z } from "zod";
import { apiError, apiOk } from "@/server/api";
import { assertCanAdminWorkspace, getRequestContext } from "@/server/context";
import { ProviderCredentialService } from "@/server/services/provider-credential-service";

const credentials = new ProviderCredentialService();

const credentialSchema = z.object({
  provider: z.enum(["gemini", "groq", "ollama"]),
  displayName: z.string().trim().min(1).max(80).optional(),
  secret: z.string().min(8)
});

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    return apiOk(await credentials.list(context));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    assertCanAdminWorkspace(context);
    return apiOk(await credentials.save(context, credentialSchema.parse(await request.json())), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
