import { prisma } from "@/lib/prisma";
import type { ComparisonReport } from "@/lib/types";
import { RequestContextError, type RequestContext } from "@/server/context";
import { EventService } from "@/server/services/event-service";

export class ComparisonService {
  private readonly events = new EventService();

  evaluateReleaseGate(report: ComparisonReport) {
    return {
      allowed: report.passFailStatus === "pass" && report.scoreDelta >= 0,
      reasons:
        report.passFailStatus === "pass"
          ? ["All configured thresholds passed."]
          : ["Candidate score failed the configured release threshold."]
    };
  }

  async createReport(
    context: RequestContext,
    input: {
      baselineRunId: string;
      candidateRunId: string;
      threshold: number;
    }
  ) {
    const [baseline, candidate] = await Promise.all([
      prisma.run.findFirstOrThrow({ where: { id: input.baselineRunId, workspaceId: context.workspaceId } }),
      prisma.run.findFirstOrThrow({ where: { id: input.candidateRunId, workspaceId: context.workspaceId } })
    ]);

    if (baseline.projectId !== candidate.projectId) {
      throw new RequestContextError("Comparison runs must belong to the same project.", 422);
    }
    if (baseline.id === candidate.id) {
      throw new RequestContextError("Choose two different runs to compare.", 422);
    }

    const baselineScore = Number(baseline.averageScore ?? 0);
    const candidateScore = Number(candidate.averageScore ?? 0);
    const scoreDelta = candidateScore - baselineScore;
    const passFailStatus = candidateScore >= input.threshold && scoreDelta >= 0 ? "pass" : "fail";

    const report = await prisma.comparisonReport.create({
      data: {
        workspaceId: context.workspaceId,
        projectId: baseline.projectId,
        baselineType: "run",
        baselineId: baseline.id,
        candidateType: "run",
        candidateId: candidate.id,
        metricSummaryJson: {
          threshold: input.threshold,
          baselineScore,
          candidateScore,
          scoreDelta,
          baselineCost: Number(baseline.totalCost),
          candidateCost: Number(candidate.totalCost)
        },
        passFailStatus,
        createdBy: context.userId
      }
    });

    await this.events.emit(context, {
      entityType: "comparison_report",
      entityId: report.id,
      action: passFailStatus === "fail" ? "regression_detected" : "comparison_created",
      payload: { baselineRunId: baseline.id, candidateRunId: candidate.id, threshold: input.threshold, baselineScore, candidateScore, scoreDelta }
    });

    return report;
  }
}
