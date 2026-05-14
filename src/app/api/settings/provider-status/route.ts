import { apiError, apiOk } from "@/server/api";
import { getRequestContext } from "@/server/context";

export async function GET(request: Request) {
  try {
    await getRequestContext(request);

    return apiOk({
      groq: { configured: Boolean(process.env.GROQ_API_KEY), source: "server-env" },
      gemini: { configured: Boolean(process.env.GEMINI_API_KEY), source: "server-env" },
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
