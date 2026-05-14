-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('owner', 'admin', 'editor', 'reviewer', 'viewer');

-- CreateEnum
CREATE TYPE "ProviderName" AS ENUM ('gemini', 'groq');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('draft', 'active', 'archived', 'approved');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "RunItemStatus" AS ENUM ('queued', 'running', 'passed', 'warning', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('active', 'disabled', 'rotated');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "auth_user_id" TEXT NOT NULL,
    "full_name" TEXT,
    "email" TEXT NOT NULL,
    "avatar_url" TEXT,
    "timezone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "invited_by" UUID,
    "joined_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_by" UUID NOT NULL,
    "default_provider" "ProviderName" NOT NULL DEFAULT 'groq',
    "default_model" TEXT NOT NULL,
    "default_temperature" DECIMAL(3,2) NOT NULL DEFAULT 0.2,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_versions" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "prompt_key" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "user_prompt_template" TEXT NOT NULL,
    "variables_schema" JSONB NOT NULL DEFAULT '{}',
    "provider" "ProviderName" NOT NULL DEFAULT 'groq',
    "model_name" TEXT NOT NULL,
    "model_params_json" JSONB NOT NULL DEFAULT '{}',
    "status" "EntityStatus" NOT NULL DEFAULT 'draft',
    "changelog" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "datasets" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source_type" TEXT NOT NULL DEFAULT 'manual',
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "status" "EntityStatus" NOT NULL DEFAULT 'draft',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dataset_cases" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "input_payload_json" JSONB NOT NULL,
    "expected_output_json" JSONB,
    "rubric_json" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "source_reference" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dataset_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "prompt_version_id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "baseline_run_id" UUID,
    "provider" "ProviderName" NOT NULL,
    "model_name" TEXT NOT NULL,
    "model_params_json" JSONB NOT NULL DEFAULT '{}',
    "status" "RunStatus" NOT NULL DEFAULT 'queued',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "total_cases" INTEGER NOT NULL DEFAULT 0,
    "passed_cases" INTEGER NOT NULL DEFAULT 0,
    "failed_cases" INTEGER NOT NULL DEFAULT 0,
    "average_score" DECIMAL(5,4),
    "total_cost" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_items" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "dataset_case_id" UUID NOT NULL,
    "status" "RunItemStatus" NOT NULL DEFAULT 'queued',
    "input_snapshot_json" JSONB NOT NULL,
    "output_snapshot_json" JSONB,
    "score" DECIMAL(5,4),
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_status_events" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "from_status" "RunStatus",
    "to_status" "RunStatus" NOT NULL,
    "reason" TEXT,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traces" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "run_item_id" UUID NOT NULL,
    "trace_key" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'running',
    "total_duration_ms" INTEGER,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trace_spans" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "trace_id" UUID NOT NULL,
    "parent_span_id" UUID,
    "span_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "input_json" JSONB,
    "output_json" JSONB,
    "tool_name" TEXT,
    "duration_ms" INTEGER,
    "tokens_in" INTEGER NOT NULL DEFAULT 0,
    "tokens_out" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trace_spans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_calls" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "run_item_id" UUID NOT NULL,
    "trace_span_id" UUID,
    "prompt_version_id" UUID NOT NULL,
    "provider" "ProviderName" NOT NULL,
    "model_name" TEXT NOT NULL,
    "temperature" DECIMAL(3,2),
    "top_p" DECIMAL(3,2),
    "seed" INTEGER,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL,
    "cost_estimate" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "raw_text" TEXT,
    "structured_json" JSONB,
    "request_json" JSONB NOT NULL DEFAULT '{}',
    "response_json" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grader_definitions" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rubric_json" JSONB NOT NULL,
    "provider" "ProviderName" NOT NULL DEFAULT 'groq',
    "model_name" TEXT NOT NULL,
    "prompt_template" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'active',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grader_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grader_results" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "trace_id" UUID NOT NULL,
    "grader_definition_id" UUID,
    "score" DECIMAL(5,4) NOT NULL,
    "label" TEXT NOT NULL,
    "rationale" TEXT,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grader_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "human_reviews" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "run_item_id" UUID NOT NULL,
    "reviewer_user_id" UUID NOT NULL,
    "verdict" TEXT NOT NULL,
    "score" DECIMAL(5,4),
    "notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "run_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "human_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparison_reports" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "baseline_type" TEXT NOT NULL,
    "baseline_id" UUID NOT NULL,
    "candidate_type" TEXT NOT NULL,
    "candidate_id" UUID NOT NULL,
    "metric_summary_json" JSONB NOT NULL,
    "pass_fail_status" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comparison_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_approvals" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "run_id" UUID,
    "prompt_version_id" UUID NOT NULL,
    "comparison_report_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "approved_by" UUID NOT NULL,
    "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "release_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_feedback" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "prompt_version_id" UUID NOT NULL,
    "run_item_id" UUID,
    "feedback_type" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_events" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID,
    "run_id" UUID,
    "event_type" TEXT NOT NULL,
    "provider" "ProviderName" NOT NULL,
    "model_name" TEXT NOT NULL,
    "tokens_in" INTEGER NOT NULL DEFAULT 0,
    "tokens_out" INTEGER NOT NULL DEFAULT 0,
    "cost_estimate" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_credentials" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "provider" "ProviderName" NOT NULL,
    "display_name" TEXT NOT NULL,
    "encrypted_secret_ref" TEXT NOT NULL,
    "status" "CredentialStatus" NOT NULL DEFAULT 'active',
    "last_used_at" TIMESTAMP(3),
    "rotated_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "background_jobs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "job_type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "run_after" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "users"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "projects_workspace_id_idx" ON "projects"("workspace_id");

-- CreateIndex
CREATE INDEX "prompt_versions_workspace_id_idx" ON "prompt_versions"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_versions_project_id_prompt_key_version_number_key" ON "prompt_versions"("project_id", "prompt_key", "version_number");

-- CreateIndex
CREATE INDEX "datasets_workspace_id_idx" ON "datasets"("workspace_id");

-- CreateIndex
CREATE INDEX "dataset_cases_workspace_id_dataset_id_idx" ON "dataset_cases"("workspace_id", "dataset_id");

-- CreateIndex
CREATE INDEX "runs_workspace_id_project_id_idx" ON "runs"("workspace_id", "project_id");

-- CreateIndex
CREATE INDEX "run_items_workspace_id_run_id_idx" ON "run_items"("workspace_id", "run_id");

-- CreateIndex
CREATE INDEX "run_status_events_workspace_id_run_id_created_at_idx" ON "run_status_events"("workspace_id", "run_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "traces_run_item_id_key" ON "traces"("run_item_id");

-- CreateIndex
CREATE INDEX "traces_workspace_id_idx" ON "traces"("workspace_id");

-- CreateIndex
CREATE INDEX "trace_spans_workspace_id_trace_id_idx" ON "trace_spans"("workspace_id", "trace_id");

-- CreateIndex
CREATE INDEX "model_calls_workspace_id_run_item_id_idx" ON "model_calls"("workspace_id", "run_item_id");

-- CreateIndex
CREATE INDEX "model_calls_prompt_version_id_idx" ON "model_calls"("prompt_version_id");

-- CreateIndex
CREATE INDEX "grader_definitions_workspace_id_idx" ON "grader_definitions"("workspace_id");

-- CreateIndex
CREATE INDEX "grader_results_workspace_id_trace_id_idx" ON "grader_results"("workspace_id", "trace_id");

-- CreateIndex
CREATE INDEX "human_reviews_workspace_id_idx" ON "human_reviews"("workspace_id");

-- CreateIndex
CREATE INDEX "comparison_reports_workspace_id_project_id_idx" ON "comparison_reports"("workspace_id", "project_id");

-- CreateIndex
CREATE INDEX "release_approvals_workspace_id_prompt_version_id_idx" ON "release_approvals"("workspace_id", "prompt_version_id");

-- CreateIndex
CREATE INDEX "prompt_feedback_workspace_id_idx" ON "prompt_feedback"("workspace_id");

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_entity_type_entity_id_idx" ON "audit_logs"("workspace_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "usage_events_workspace_id_occurred_at_idx" ON "usage_events"("workspace_id", "occurred_at");

-- CreateIndex
CREATE INDEX "provider_credentials_workspace_id_idx" ON "provider_credentials"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_credentials_workspace_id_provider_display_name_key" ON "provider_credentials"("workspace_id", "provider", "display_name");

-- CreateIndex
CREATE INDEX "background_jobs_workspace_id_status_run_after_idx" ON "background_jobs"("workspace_id", "status", "run_after");

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataset_cases" ADD CONSTRAINT "dataset_cases_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "prompt_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_items" ADD CONSTRAINT "run_items_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_items" ADD CONSTRAINT "run_items_dataset_case_id_fkey" FOREIGN KEY ("dataset_case_id") REFERENCES "dataset_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_status_events" ADD CONSTRAINT "run_status_events_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traces" ADD CONSTRAINT "traces_run_item_id_fkey" FOREIGN KEY ("run_item_id") REFERENCES "run_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trace_spans" ADD CONSTRAINT "trace_spans_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "traces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_run_item_id_fkey" FOREIGN KEY ("run_item_id") REFERENCES "run_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "prompt_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grader_results" ADD CONSTRAINT "grader_results_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "traces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grader_results" ADD CONSTRAINT "grader_results_grader_definition_id_fkey" FOREIGN KEY ("grader_definition_id") REFERENCES "grader_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_run_item_id_fkey" FOREIGN KEY ("run_item_id") REFERENCES "run_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_approvals" ADD CONSTRAINT "release_approvals_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_approvals" ADD CONSTRAINT "release_approvals_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "prompt_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_feedback" ADD CONSTRAINT "prompt_feedback_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "prompt_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_feedback" ADD CONSTRAINT "prompt_feedback_run_item_id_fkey" FOREIGN KEY ("run_item_id") REFERENCES "run_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

