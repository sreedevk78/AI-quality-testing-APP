import { prisma } from "@/lib/prisma";
import { apiOk } from "@/server/api";

export async function GET() {
  const checks = {
    database: false,
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY)
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  const ok = Object.values(checks).every(Boolean);

  return apiOk(
    {
      ok,
      checks,
      timestamp: new Date().toISOString()
    },
    { status: ok ? 200 : 503 }
  );
}
