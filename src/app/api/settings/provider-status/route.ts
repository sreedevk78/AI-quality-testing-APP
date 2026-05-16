import { apiError, apiOk } from "@/server/api";
import { getRequestContext } from "@/server/context";
import { ProviderCredentialService } from "@/server/services/provider-credential-service";

const credentials = new ProviderCredentialService();

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const workspaceCredentials = await credentials.list(context);
    const activeProviders = new Set(
      workspaceCredentials.filter((credential) => credential.status === "active").map((credential) => credential.provider)
    );

    return apiOk({
      groq: { configured: activeProviders.has("groq") || Boolean(process.env.GROQ_API_KEY), source: activeProviders.has("groq") ? "workspace-secret" : "server-env" },
      gemini: { configured: activeProviders.has("gemini") || Boolean(process.env.GEMINI_API_KEY), source: activeProviders.has("gemini") ? "workspace-secret" : "server-env" },
      ollama: { configured: activeProviders.has("ollama") || Boolean(process.env.OLLAMA_BASE_URL), source: activeProviders.has("ollama") ? "workspace-secret" : "server-env" },
      supabase: {
        urlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        publishableKeyConfigured: Boolean(
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ),
        databaseConfigured: Boolean(process.env.DATABASE_URL)
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
