-- Align tables created before the production hardening pass with the current Prisma schema.

ALTER TABLE "grader_definitions"
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'llm_rubric';

DROP INDEX IF EXISTS "background_jobs_idempotency_key_key";
CREATE UNIQUE INDEX IF NOT EXISTS "background_jobs_idempotency_key_key"
  ON "background_jobs"("idempotency_key");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'comparison_reports_baseline_id_fkey'
      AND table_name = 'comparison_reports'
  ) THEN
    ALTER TABLE "comparison_reports"
      ADD CONSTRAINT "comparison_reports_baseline_id_fkey"
      FOREIGN KEY ("baseline_id") REFERENCES "runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'comparison_reports_candidate_id_fkey'
      AND table_name = 'comparison_reports'
  ) THEN
    ALTER TABLE "comparison_reports"
      ADD CONSTRAINT "comparison_reports_candidate_id_fkey"
      FOREIGN KEY ("candidate_id") REFERENCES "runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'audit_logs_actor_user_id_fkey'
      AND table_name = 'audit_logs'
  ) THEN
    ALTER TABLE "audit_logs"
      ADD CONSTRAINT "audit_logs_actor_user_id_fkey"
      FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
