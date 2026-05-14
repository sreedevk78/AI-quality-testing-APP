import { prisma } from "@/lib/prisma";
import type { ComparisonReport } from "@/lib/types";
import type { RequestContext } from "@/server/context";

export class ComparisonService {
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

    const baselineScore = Number(baseline.averageScore ?? 0);
    const candidateScore = Number(candidate.averageScore ?? 0);
    const scoreDelta = candidateScore - baselineScore;
    const passFailStatus = candidateScore >= input.threshold && scoreDelta >= 0 ? "pass" : "fail";

    return prisma.comparisonReport.create({
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
  }
}
