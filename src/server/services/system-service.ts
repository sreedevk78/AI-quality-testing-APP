import type { Prisma, RunItemStatus, RunStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EventService } from "@/server/services/event-service";

const ACTIVE_ITEM_STATUSES: RunItemStatus[] = ["running", "queued", "retrying"];
const REVIEW_PENDING_STATUSES: RunItemStatus[] = ["needs_review", "warning"];
const TRACE_REQUIRED_STATUSES: RunItemStatus[] = ["passed", "failed", "needs_review", "warning"];

type CleanupSummary = {
  reviewedItemsReconciled: number;
  tracesCreated: number;
  modelCallsCreated: number;
  stuckItemsFailed: number;
  completedJobLeasesCleared: number;
};

export class SystemService {
  /**
   * Repairs operational invariants that can be left behind by interrupted workers,
   * older seed data, or review submissions from previous app versions.
   */
  async cleanupZombieJobs(workspaceId: string): Promise<CleanupSummary> {
    const summary: CleanupSummary = {
      reviewedItemsReconciled: 0,
      tracesCreated: 0,
      modelCallsCreated: 0,
      stuckItemsFailed: 0,
      completedJobLeasesCleared: 0
    };

    const affectedRunIds = new Set<string>();

    const reviewed = await this.reconcileReviewedItems(workspaceId);
    summary.reviewedItemsReconciled = reviewed.count;
    reviewed.runIds.forEach((runId) => affectedRunIds.add(runId));

    const traces = await this.reconcileMissingTraces(workspaceId);
    summary.tracesCreated = traces.count;
    traces.runIds.forEach((runId) => affectedRunIds.add(runId));

    summary.modelCallsCreated = await this.reconcileMissingModelCalls(workspaceId);

    const stuck = await this.failStuckItems(workspaceId);
    summary.stuckItemsFailed = stuck.count;
    stuck.runIds.forEach((runId) => affectedRunIds.add(runId));

    const clearedJobs = await prisma.backgroundJob.updateMany({
      where: {
        workspaceId,
        status: "completed",
        OR: [{ lockedAt: { not: null } }, { lockedBy: { not: null } }, { lastHeartbeatAt: { not: null } }]
      },
      data: {
        lockedAt: null,
        lockedBy: null,
        lastHeartbeatAt: null
      }
    });
    summary.completedJobLeasesCleared = clearedJobs.count;

    for (const runId of affectedRunIds) {
      await this.recalculateRunStatus(workspaceId, runId, "System cleanup reconciled run item state");
    }

    const touched = Object.values(summary).reduce((sum, value) => sum + value, 0);
    if (touched > 0) {
      console.info(JSON.stringify({ component: "system-cleanup", workspaceId, ...summary }));
    }

    return summary;
  }

  private async reconcileReviewedItems(workspaceId: string) {
    const reviewedItems = await prisma.runItem.findMany({
      where: {
        workspaceId,
        status: { in: REVIEW_PENDING_STATUSES },
        reviews: { some: { reviewedAt: { not: null } } }
      },
      include: {
        trace: true,
        reviews: {
          orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
          take: 1
        }
      }
    });

    const runIds = new Set<string>();
    let count = 0;

    for (const item of reviewedItems) {
      const review = item.reviews[0];
      const nextStatus = statusFromReviewVerdict(review?.verdict, item.status);
      if (!review || nextStatus === item.status) continue;

      await prisma.$transaction(async (tx) => {
        const trace = item.trace ??
          await tx.trace.create({
            data: {
              workspaceId,
              runItemId: item.id,
              traceKey: `review_repair_${item.id}`,
              status: traceStatusFromItemStatus(nextStatus)
            }
          });

        await tx.runItem.update({
          where: { id: item.id },
          data: {
            status: nextStatus,
            score: review.score ?? item.score,
            completedAt: new Date(),
            errorMessage: nextStatus === "passed" ? null : item.errorMessage ?? "Human review requested changes."
          }
        });

        await tx.traceSpan.create({
          data: {
            workspaceId,
            traceId: trace.id,
            spanType: "review",
            name: `human_review_reconciled:${review.verdict}`,
            inputJson: { runItemId: item.id } as Prisma.InputJsonValue,
            outputJson: {
              verdict: review.verdict,
              score: review.score,
              notes: review.notes,
              reconciledFrom: item.status,
              reconciledTo: nextStatus
            } as Prisma.InputJsonValue,
            durationMs: 0,
            status: nextStatus,
            metadataJson: { reviewerUserId: review.reviewerUserId, reviewId: review.id, source: "system_cleanup" } as Prisma.InputJsonValue
          }
        });

        await tx.trace.update({
          where: { id: trace.id },
          data: { status: traceStatusFromItemStatus(nextStatus), updatedAt: new Date() }
        });

        await new EventService(tx).emitRaw({
          workspaceId,
          entityType: "run_item",
          entityId: item.id,
          action: nextStatus === "passed" ? "review_approved" : "review_rejected",
          payload: {
            reviewId: review.id,
            runId: item.runId,
            verdict: review.verdict,
            reconciled: true,
            fromStatus: item.status,
            toStatus: nextStatus
          }
        });
      });

      runIds.add(item.runId);
      count += 1;
    }

    return { count, runIds };
  }

  private async reconcileMissingTraces(workspaceId: string) {
    const items = await prisma.runItem.findMany({
      where: {
        workspaceId,
        status: { in: TRACE_REQUIRED_STATUSES },
        trace: { is: null }
      },
      include: {
        run: true,
        datasetCase: true
      }
    });

    const runIds = new Set<string>();

    for (const item of items) {
      const traceStatus = traceStatusFromItemStatus(item.status);
      await prisma.$transaction(async (tx) => {
        const trace = await tx.trace.create({
          data: {
            workspaceId,
            runItemId: item.id,
            traceKey: `reconciled_${item.runId}_${item.id}`,
            status: traceStatus,
            totalDurationMs: item.startedAt && item.completedAt ? Math.max(0, item.completedAt.getTime() - item.startedAt.getTime()) : null
          }
        });

        await tx.traceSpan.create({
          data: {
            workspaceId,
            traceId: trace.id,
            spanType: "root",
            name: `reconciled_run_item:${item.id}`,
            inputJson: item.inputSnapshotJson as Prisma.InputJsonValue,
            outputJson: {
              output: item.outputSnapshotJson,
              status: item.status,
              score: item.score,
              errorMessage: item.errorMessage
            } as Prisma.InputJsonValue,
            durationMs: item.startedAt && item.completedAt ? Math.max(0, item.completedAt.getTime() - item.startedAt.getTime()) : 0,
            status: item.status,
            metadataJson: {
              runId: item.runId,
              runItemId: item.id,
              promptVersionId: item.run.promptVersionId,
              datasetCaseId: item.datasetCaseId,
              source: "system_cleanup"
            } as Prisma.InputJsonValue
          }
        });
      });

      runIds.add(item.runId);
    }

    return { count: items.length, runIds };
  }

  private async reconcileMissingModelCalls(workspaceId: string) {
    const traces = await prisma.trace.findMany({
      where: { workspaceId },
      include: {
        spans: { orderBy: { createdAt: "asc" } },
        runItem: {
          include: {
            run: true,
            modelCalls: { select: { id: true }, take: 1 }
          }
        }
      }
    });

    let count = 0;
    for (const trace of traces) {
      if (trace.runItem.modelCalls.length > 0 || trace.runItem.outputSnapshotJson === null) continue;

      const rootSpan = trace.spans.find((span) => span.spanType === "root");
      let modelSpan = trace.spans.find((span) => span.spanType === "model");
      const durationMs = trace.totalDurationMs ?? rootSpan?.durationMs ?? 0;

      if (!modelSpan) {
        modelSpan = await prisma.traceSpan.create({
          data: {
            workspaceId,
            traceId: trace.id,
            parentSpanId: rootSpan?.id,
            spanType: "model",
            name: `${trace.runItem.run.provider}:${trace.runItem.run.modelName}:reconciled`,
            inputJson: {
              input: trace.runItem.inputSnapshotJson,
              source: "system_cleanup"
            } as Prisma.InputJsonValue,
            outputJson: trace.runItem.outputSnapshotJson as Prisma.InputJsonValue,
            durationMs,
            status: trace.runItem.status,
            metadataJson: {
              provider: trace.runItem.run.provider,
              model: trace.runItem.run.modelName,
              reconciled: true
            } as Prisma.InputJsonValue
          }
        });
      }

      const modelParams = asRecord(trace.runItem.run.modelParamsJson);
      await prisma.modelCall.create({
        data: {
          workspaceId,
          runItemId: trace.runItemId,
          traceSpanId: modelSpan.id,
          promptVersionId: trace.runItem.run.promptVersionId,
          provider: trace.runItem.run.provider,
          modelName: trace.runItem.run.modelName,
          temperature: asNumber(modelParams.temperature),
          topP: asNumber(modelParams.topP),
          inputTokens: modelSpan.tokensIn,
          outputTokens: modelSpan.tokensOut,
          latencyMs: modelSpan.durationMs ?? durationMs,
          costEstimate: trace.totalCost,
          rawText: stringifyJsonish(trace.runItem.outputSnapshotJson),
          structuredJson: trace.runItem.outputSnapshotJson as Prisma.InputJsonValue,
          requestJson: (modelSpan.inputJson ?? {}) as Prisma.InputJsonValue,
          responseJson: (modelSpan.outputJson ?? { output: trace.runItem.outputSnapshotJson }) as Prisma.InputJsonValue,
          status: trace.runItem.status
        }
      });

      await new EventService().emitRaw({
        workspaceId,
        entityType: "run_item",
        entityId: trace.runItemId,
        action: "model_call_completed",
        payload: {
          runId: trace.runItem.runId,
          status: trace.runItem.status,
          reconciled: true,
          traceId: trace.id
        }
      });

      count += 1;
    }

    return count;
  }

  private async failStuckItems(workspaceId: string) {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const stuckItems = await prisma.runItem.findMany({
      where: {
        workspaceId,
        status: { in: ACTIVE_ITEM_STATUSES },
        updatedAt: { lt: tenMinutesAgo }
      },
      select: { id: true, runId: true, status: true }
    });

    if (stuckItems.length === 0) {
      return { count: 0, runIds: new Set<string>() };
    }

    await prisma.runItem.updateMany({
      where: { id: { in: stuckItems.map((item) => item.id) } },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: "System: Interrupted due to worker, database, or network timeout."
      }
    });

    await new EventService().emitRaw({
      workspaceId,
      entityType: "run_item",
      entityId: stuckItems[0].id,
      action: "run_failed",
      payload: {
        reconciled: true,
        reason: "stale_active_run_items",
        count: stuckItems.length,
        itemIds: stuckItems.map((item) => item.id)
      }
    });

    return { count: stuckItems.length, runIds: new Set(stuckItems.map((item) => item.runId)) };
  }

  private async recalculateRunStatus(workspaceId: string, runId: string, reason: string) {
    await prisma.$transaction(async (tx) => {
      const run = await tx.run.findFirst({
        where: { id: runId, workspaceId },
        select: { id: true, status: true, createdBy: true }
      });
      if (!run || run.status === "cancelled") return;

      const items = await tx.runItem.findMany({
        where: { runId, workspaceId },
        select: { status: true, score: true }
      });

      const passed = items.filter((item) => item.status === "passed").length;
      const failed = items.filter((item) => item.status === "failed").length;
      const needsReview = items.filter((item) => item.status === "needs_review" || item.status === "warning").length;
      const active = items.filter((item) => ACTIVE_ITEM_STATUSES.includes(item.status)).length;
      const scored = items.filter((item) => item.score !== null);
      const totalCost = await tx.trace.aggregate({
        where: { workspaceId, runItem: { runId } },
        _sum: { totalCost: true }
      });
      const averageScore =
        scored.length > 0 ? scored.reduce((sum, item) => sum + Number(item.score ?? 0), 0) / scored.length : null;
      const nextStatus: RunStatus =
        active > 0
          ? "running"
          : failed > 0 && (passed > 0 || needsReview > 0)
            ? "partially_failed"
            : failed > 0
              ? "failed"
              : needsReview > 0
                ? "needs_review"
                : "completed";

      await tx.run.update({
        where: { id: runId },
        data: {
          status: nextStatus,
          passedCases: passed,
          failedCases: failed,
          averageScore,
          totalCost: Number(totalCost._sum.totalCost ?? 0),
          completedAt: active > 0 ? null : new Date()
        }
      });

      if (run.status === nextStatus) return;

      await tx.runStatusEvent.create({
        data: {
          workspaceId,
          runId,
          fromStatus: run.status,
          toStatus: nextStatus,
          reason,
          metadataJson: { passed, failed, needsReview, active, reconciled: true } as Prisma.InputJsonValue
        }
      });

      await new EventService(tx).emitRaw({
        workspaceId,
        actorUserId: run.createdBy,
        entityType: "run",
        entityId: runId,
        action: nextStatus === "failed" ? "run_failed" : nextStatus === "needs_review" ? "review_requested" : "run_completed",
        payload: { passed, failed, needsReview, active, averageScore, reconciled: true }
      });
    });
  }
}

function statusFromReviewVerdict(verdict: string | undefined, fallback: RunItemStatus): RunItemStatus {
  if (verdict === "approved") return "passed";
  if (verdict === "needs_fix" || verdict === "rejected") return "failed";
  return fallback;
}

function traceStatusFromItemStatus(status: RunItemStatus): RunStatus {
  if (status === "passed") return "completed";
  if (status === "failed") return "failed";
  if (status === "needs_review" || status === "warning") return "needs_review";
  if (status === "retrying") return "retrying";
  if (status === "cancelled") return "cancelled";
  if (status === "queued") return "queued";
  return "running";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringifyJsonish(value: unknown) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}
