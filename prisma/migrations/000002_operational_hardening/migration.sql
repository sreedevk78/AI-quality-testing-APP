-- Operational hardening for production run orchestration, provider coverage, and event history.

ALTER TYPE "ProviderName" ADD VALUE IF NOT EXISTS 'ollama';

ALTER TYPE "RunStatus" ADD VALUE IF NOT EXISTS 'initializing';
ALTER TYPE "RunStatus" ADD VALUE IF NOT EXISTS 'retrying';
ALTER TYPE "RunStatus" ADD VALUE IF NOT EXISTS 'partially_failed';
ALTER TYPE "RunStatus" ADD VALUE IF NOT EXISTS 'needs_review';

ALTER TYPE "RunItemStatus" ADD VALUE IF NOT EXISTS 'retrying';
ALTER TYPE "RunItemStatus" ADD VALUE IF NOT EXISTS 'needs_review';

CREATE TABLE IF NOT EXISTS "system_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sequence" SERIAL NOT NULL,
  "workspace_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "payload_json" JSONB NOT NULL DEFAULT '{}',
  "metadata_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_events_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'system_events_workspace_id_fkey'
      AND table_name = 'system_events'
  ) THEN
    ALTER TABLE "system_events"
      ADD CONSTRAINT "system_events_workspace_id_fkey"
      FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'system_events_actor_user_id_fkey'
      AND table_name = 'system_events'
  ) THEN
    ALTER TABLE "system_events"
      ADD CONSTRAINT "system_events_actor_user_id_fkey"
      FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "system_events_workspace_id_entity_type_entity_id_created_at_idx"
  ON "system_events"("workspace_id", "entity_type", "entity_id", "created_at");

CREATE INDEX IF NOT EXISTS "system_events_workspace_id_action_created_at_idx"
  ON "system_events"("workspace_id", "action", "created_at");

CREATE INDEX IF NOT EXISTS "system_events_workspace_id_sequence_idx"
  ON "system_events"("workspace_id", "sequence");

ALTER TABLE "background_jobs" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "background_jobs" ADD COLUMN IF NOT EXISTS "max_attempts" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "background_jobs" ADD COLUMN IF NOT EXISTS "locked_by" TEXT;
ALTER TABLE "background_jobs" ADD COLUMN IF NOT EXISTS "last_heartbeat_at" TIMESTAMP(3);
ALTER TABLE "background_jobs" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);
ALTER TABLE "background_jobs" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;
ALTER TABLE "background_jobs" ADD COLUMN IF NOT EXISTS "metadata_json" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "background_jobs_status_run_after_priority_idx"
  ON "background_jobs"("status", "run_after", "priority");

CREATE UNIQUE INDEX IF NOT EXISTS "background_jobs_idempotency_key_key"
  ON "background_jobs"("idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
