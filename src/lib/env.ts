import { z } from "zod";

const envSchema = z.object({
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().optional().or(z.literal("")),
  OLLAMA_API_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  SECRET_ENCRYPTION_KEY: z.string().optional(),
  WORKER_ID: z.string().optional(),
  WORKER_CONCURRENCY: z.string().optional(),
  WORKER_BATCH_SIZE: z.string().optional(),
  WORKER_POLL_MS: z.string().optional(),
  WORKER_MAX_ATTEMPTS: z.string().optional(),
  RUN_MAX_CASES_PER_RUN: z.string().optional(),
  RUN_COST_LIMIT_USD: z.string().optional(),
  RUN_MONTHLY_COST_LIMIT_USD: z.string().optional(),
  AI_RUN_MAX_ESTIMATED_COST: z.string().optional()
});

export const env = envSchema.parse(process.env);
