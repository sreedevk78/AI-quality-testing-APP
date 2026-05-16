# AI QA Evaluation Lab Deployment

## Required Environment

Set these values in each environment. Do not expose provider secrets to the browser.

- `DATABASE_URL`: Supabase pooler connection string for application queries.
- `DIRECT_URL`: Supabase migration connection string.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key for trusted server work.
- `SECRET_ENCRYPTION_KEY`: 32+ character secret used to encrypt workspace provider credentials.
- `GROQ_API_KEY`: optional server fallback if no workspace credential exists.
- `GEMINI_API_KEY`: optional server fallback if no workspace credential exists.
- `OLLAMA_BASE_URL`: optional local or private Ollama endpoint.
- `WORKER_CONCURRENCY`: evaluation worker concurrency, default `2`.
- `WORKER_POLL_MS`: worker poll interval, default `3000`.
- `RUN_MAX_CASES_PER_RUN`: runaway protection, default `1000`.
- `RUN_COST_LIMIT_USD`: per-run budget guardrail.
- `RUN_MONTHLY_COST_LIMIT_USD`: workspace monthly budget guardrail.

## Release Checklist

1. Install dependencies with `npm ci`.
2. Generate Prisma client with `npm run prisma:generate`.
3. Apply migrations with `npm run prisma:deploy`.
4. Apply Supabase policies with `npx prisma db execute --file supabase/rls.sql --schema prisma/schema.prisma`.
5. Seed only non-production environments with `npm run prisma:seed`.
6. Verify quality gates:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
7. Start the web process with `npm run start`.
8. Start at least one worker process with `npm run worker:evaluate`.

## Worker Strategy

The evaluation worker leases rows from `background_jobs` with `FOR UPDATE SKIP LOCKED`, heartbeats active jobs, retries transient provider failures, and recovers stale leases at startup. Run multiple worker processes only after setting a stable `WORKER_ID` prefix per instance.

## Secret Handling

Workspace provider credentials are encrypted before storage in `provider_credentials`. The UI never returns plaintext secrets. Server environment keys remain as a fallback for development and emergency operation.
