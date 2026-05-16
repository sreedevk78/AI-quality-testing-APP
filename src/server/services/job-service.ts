import type { BackgroundJob, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EventService } from "@/server/services/event-service";

export const DEFAULT_JOB_LEASE_MS = 5 * 60 * 1000;

export class JobService {
  async enqueue(input: {
    workspaceId: string;
    jobType: string;
    payload: Prisma.InputJsonValue;
    runAfter?: Date;
    priority?: number;
    idempotencyKey?: string;
    maxAttempts?: number;
  }) {
    if (input.idempotencyKey) {
      const existing = await prisma.backgroundJob.findUnique({
        where: { idempotencyKey: input.idempotencyKey }
      });

      if (existing && ["queued", "running", "retrying", "initializing"].includes(existing.status)) {
        if (existing.status === "running") {
          return existing;
        }

        return prisma.backgroundJob.update({
          where: { id: existing.id },
          data: {
            status: "queued",
            payloadJson: input.payload,
            runAfter: input.runAfter ?? new Date(),
            priority: input.priority ?? 0,
            errorMessage: null,
            lockedAt: null,
            lockedBy: null,
            lastHeartbeatAt: null,
            completedAt: null,
            maxAttempts: input.maxAttempts ?? Number(process.env.WORKER_MAX_ATTEMPTS ?? 3)
          }
        });
      }

      if (existing) {
        return prisma.backgroundJob.update({
          where: { id: existing.id },
          data: {
            status: "queued",
            payloadJson: input.payload,
            runAfter: input.runAfter ?? new Date(),
            priority: input.priority ?? 0,
            attempts: 0,
            errorMessage: null,
            lockedAt: null,
            lockedBy: null,
            lastHeartbeatAt: null,
            completedAt: null,
            maxAttempts: input.maxAttempts ?? Number(process.env.WORKER_MAX_ATTEMPTS ?? 3)
          }
        });
      }

      return prisma.backgroundJob.create({
        data: {
          workspaceId: input.workspaceId,
          jobType: input.jobType,
          payloadJson: input.payload,
          status: "queued",
          runAfter: input.runAfter ?? new Date(),
          priority: input.priority ?? 0,
          idempotencyKey: input.idempotencyKey,
          maxAttempts: input.maxAttempts ?? Number(process.env.WORKER_MAX_ATTEMPTS ?? 3)
        }
      });
    }

    return prisma.backgroundJob.create({
      data: {
        workspaceId: input.workspaceId,
        jobType: input.jobType,
        payloadJson: input.payload,
        status: "queued",
        runAfter: input.runAfter ?? new Date(),
        priority: input.priority ?? 0,
        idempotencyKey: input.idempotencyKey,
        maxAttempts: input.maxAttempts ?? Number(process.env.WORKER_MAX_ATTEMPTS ?? 3)
      }
    });
  }

  leaseNextJobs(input: { workerId: string; limit: number; leaseMs?: number }) {
    const staleBefore = new Date(Date.now() - (input.leaseMs ?? DEFAULT_JOB_LEASE_MS));
    return prisma.$queryRaw<BackgroundJob[]>`
      UPDATE "background_jobs"
      SET
        "status" = 'running'::"RunStatus",
        "locked_at" = NOW(),
        "locked_by" = ${input.workerId},
        "last_heartbeat_at" = NOW(),
        "attempts" = "attempts" + 1,
        "updated_at" = NOW()
      WHERE "id" IN (
        SELECT "id"
        FROM "background_jobs"
        WHERE "status" IN ('queued'::"RunStatus", 'retrying'::"RunStatus")
          AND "run_after" <= NOW()
          AND ("locked_at" IS NULL OR "locked_at" < ${staleBefore})
        ORDER BY "priority" DESC, "run_after" ASC, "created_at" ASC
        LIMIT ${input.limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        "id",
        "workspace_id" AS "workspaceId",
        "job_type" AS "jobType",
        "payload_json" AS "payloadJson",
        "status",
        "priority",
        "attempts",
        "max_attempts" AS "maxAttempts",
        "run_after" AS "runAfter",
        "locked_at" AS "lockedAt",
        "locked_by" AS "lockedBy",
        "last_heartbeat_at" AS "lastHeartbeatAt",
        "completed_at" AS "completedAt",
        "idempotency_key" AS "idempotencyKey",
        "metadata_json" AS "metadataJson",
        "error_message" AS "errorMessage",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
    `;
  }

  heartbeat(jobId: string, workerId: string) {
    return prisma.backgroundJob.updateMany({
      where: { id: jobId, lockedBy: workerId, status: "running" },
      data: { lastHeartbeatAt: new Date() }
    });
  }

  async complete(job: BackgroundJob, workerId: string, payload: unknown = {}) {
    const updated = await prisma.backgroundJob.updateMany({
      where: { id: job.id, lockedBy: workerId },
      data: {
        status: "completed",
        errorMessage: null,
        completedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lastHeartbeatAt: null,
        metadataJson: payload as Prisma.InputJsonValue
      }
    });

    await new EventService().emitRaw({
      workspaceId: job.workspaceId,
      entityType: "background_job",
      entityId: job.id,
      action: "job_completed",
      payload: { jobType: job.jobType, attempts: job.attempts }
    });

    return updated;
  }

  async fail(job: BackgroundJob, workerId: string, error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown job error";
    const shouldRetry = job.attempts < job.maxAttempts;
    const runAfter = new Date(Date.now() + calculateBackoffMs(job.attempts));
    const status = shouldRetry ? "retrying" : "failed";
    const updated = await prisma.backgroundJob.updateMany({
      where: { id: job.id, lockedBy: workerId },
      data: {
        status,
        errorMessage: message,
        runAfter,
        lockedAt: null,
        lockedBy: null,
        lastHeartbeatAt: null,
        completedAt: shouldRetry ? null : new Date()
      }
    });

    await new EventService().emitRaw({
      workspaceId: job.workspaceId,
      entityType: "background_job",
      entityId: job.id,
      action: shouldRetry ? "job_retry_scheduled" : "job_failed",
      payload: { jobType: job.jobType, attempts: job.attempts, maxAttempts: job.maxAttempts, error: message, runAfter }
    });

    return updated;
  }

  recoverStaleJobs(input: { staleMs?: number } = {}) {
    const staleBefore = new Date(Date.now() - (input.staleMs ?? DEFAULT_JOB_LEASE_MS));
    return prisma.$executeRaw`
      UPDATE "background_jobs"
      SET
        "status" = CASE
          WHEN "attempts" >= "max_attempts" THEN 'failed'::"RunStatus"
          ELSE 'retrying'::"RunStatus"
        END,
        "error_message" = COALESCE("error_message", 'Worker lease expired'),
        "run_after" = NOW() + interval '30 seconds',
        "locked_at" = NULL,
        "locked_by" = NULL,
        "last_heartbeat_at" = NULL,
        "updated_at" = NOW()
      WHERE "status" = 'running'::"RunStatus"
        AND "locked_at" < ${staleBefore}
    `;
  }
}

export function calculateBackoffMs(attempts: number) {
  const bounded = Math.min(Math.max(attempts, 1), 6);
  return Math.round(1000 * 2 ** bounded + Math.random() * 500);
}
