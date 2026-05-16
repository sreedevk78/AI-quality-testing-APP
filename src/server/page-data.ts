import { prisma } from "@/lib/prisma";
import type {
  ComparisonReport,
  Dataset,
  EvalRun,
  PromptVersion,
  ReviewItem,
  TraceSpan
} from "@/lib/types";
import { DEMO_WORKSPACE_ID, DEMO_PROJECT_ID } from "@/server/context";

import { SystemService } from "@/server/services/system-service";

export async function getDashboardData(workspaceId = DEMO_WORKSPACE_ID) {
  // Background cleanup of stale jobs
  new SystemService().cleanupZombieJobs(workspaceId).catch(console.error);

  const [dbRuns, dbDatasets, dbPrompts] = await Promise.all([
    prisma.run.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: { items: true },
      take: 10
    }),
    prisma.dataset.findMany({
      where: { workspaceId },
      include: { cases: true },
      take: 10
    }),
    prisma.promptVersion.findMany({
      where: { workspaceId },
      orderBy: [{ promptKey: "asc" }, { versionNumber: "desc" }],
      take: 10
    })
  ]);

  return {
    runs: dbRuns.map((run): EvalRun => ({
      id: run.id,
      name: `${run.modelName} evaluation`,
      promptVersion: run.promptVersionId,
      dataset: run.datasetId,
      provider: run.provider,
      model: run.modelName,
      status: run.status as EvalRun["status"],
      progress: run.totalCases ? run.items.filter((item) => item.status !== "queued").length / run.totalCases : 0,
      averageScore: Number(run.averageScore ?? 0),
      totalCost: Number(run.totalCost),
      failures: run.failedCases,
      createdAt: run.createdAt.toISOString(),
      items: []
    })),
    datasets: dbDatasets.map(mapDataset),
    promptVersions: dbPrompts.map(mapPrompt)
  };
}

export async function getPromptPageData(workspaceId = DEMO_WORKSPACE_ID) {
  const rows = await prisma.promptVersion.findMany({
    where: { workspaceId },
    orderBy: [{ promptKey: "asc" }, { versionNumber: "desc" }]
  });
  return rows.map(mapPrompt);
}

export async function getDatasetPageData(workspaceId = DEMO_WORKSPACE_ID) {
  const rows = await prisma.dataset.findMany({
    where: { workspaceId },
    include: { cases: true },
    orderBy: { updatedAt: "desc" }
  });
  return rows.map(mapDataset);
}

export async function getRunsPageData(workspaceId = DEMO_WORKSPACE_ID) {
  const rows = await prisma.run.findMany({
    where: { workspaceId },
    include: { items: { include: { datasetCase: true, trace: { select: { id: true, totalDurationMs: true, totalCost: true } } } } },
    orderBy: { createdAt: "desc" }
  });
  return rows.map(
    (run): EvalRun => ({
      id: run.id,
      name: `${run.modelName} evaluation`,
      promptVersion: run.promptVersionId,
      dataset: run.datasetId,
      provider: run.provider,
      model: run.modelName,
      status: run.status as EvalRun["status"],
      progress: run.totalCases ? run.items.filter((item) => item.status !== "queued").length / run.totalCases : 0,
      averageScore: Number(run.averageScore ?? 0),
      totalCost: Number(run.totalCost),
      failures: run.failedCases,
      createdAt: run.createdAt.toISOString(),
      items: run.items.map((item) => ({
        id: item.id,
        caseName: JSON.stringify(item.datasetCase.inputPayloadJson ?? {}).slice(0, 80),
        status: mapRunItemStatus(item.status),
        score: Number(item.score ?? 0),
        latencyMs: item.trace?.totalDurationMs ?? 0,
        cost: Number(item.trace?.totalCost ?? 0),
        traceId: item.trace?.id ?? ""
      }))
    })
  );
}

export async function getTracePageData(workspaceId = DEMO_WORKSPACE_ID) {
  const spans = await prisma.traceSpan.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    take: 50
  });
  return spans.map(
    (span): TraceSpan => ({
      id: span.id,
      parentId: span.parentSpanId ?? undefined,
      type: span.spanType as TraceSpan["type"],
      name: span.name,
      status: span.status === "passed" ? "pass" : span.status === "failed" ? "fail" : "running",
      durationMs: span.durationMs ?? 0,
      tokensIn: span.tokensIn,
      tokensOut: span.tokensOut,
      input: JSON.stringify(span.inputJson ?? {}, null, 2),
      output: JSON.stringify(span.outputJson ?? {}, null, 2)
    })
  );
}

export async function getReviewPageData(workspaceId = DEMO_WORKSPACE_ID) {
  // Background cleanup of stale jobs
  new SystemService().cleanupZombieJobs(workspaceId).catch(console.error);

  const rows = await prisma.runItem.findMany({
    where: { workspaceId, status: { in: ["warning", "failed", "needs_review"] }, reviews: { none: {} } },
    include: { run: true, datasetCase: true },
    orderBy: { updatedAt: "desc" }
  });
  return rows.map(
    (row): ReviewItem => ({
      id: row.id,
      caseName: JSON.stringify(row.datasetCase.inputPayloadJson).slice(0, 50),
      run: `${row.run.provider} / ${row.run.modelName}`,
      runId: row.runId,
      score: Number(row.score ?? 0),
      rubric: JSON.stringify(row.datasetCase.rubricJson).slice(0, 100),
      status: mapReviewStatus(row.status),
      input: JSON.stringify(row.datasetCase.inputPayloadJson, null, 2),
      output: JSON.stringify(row.outputSnapshotJson, null, 2),
      expected: JSON.stringify(row.datasetCase.expectedOutputJson, null, 2)
    })
  );
}

export async function getGraderDefinitions(workspaceId = DEMO_WORKSPACE_ID) {
  return prisma.graderDefinition.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" }
  });
}

export async function getComparisonPageData(workspaceId = DEMO_WORKSPACE_ID) {
  const rows = await prisma.comparisonReport.findMany({
    where: { workspaceId },
    include: {
      candidateRun: { select: { promptVersionId: true, id: true } },
      baselineRun: { select: { id: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return rows.map(
    (row): ComparisonReport => {
      const summary = row.metricSummaryJson as Record<string, number>;
      return {
        id: row.id,
        baseline: row.baselineId.slice(0, 8),
        candidate: row.candidateId.slice(0, 8),
        passFailStatus: row.passFailStatus === "pass" ? "pass" : "fail",
        scoreDelta: Number(summary.scoreDelta ?? 0),
        latencyDelta: Number(summary.latencyDelta ?? 0),
        costDelta: Number(summary.costDelta ?? 0),
        threshold: Number(summary.threshold ?? 0.85),
        candidatePromptVersionId: row.candidateRun?.promptVersionId ?? undefined,
        candidateRunId: row.candidateRun?.id,
        baselineScore: Number(summary.baselineScore ?? 0),
        candidateScore: Number(summary.candidateScore ?? 0)
      };
    }
  );
}

export async function getAnalyticsPageData(workspaceId = DEMO_WORKSPACE_ID) {
  const [runs, usage, traceCount, itemCount, passedItems, failedItemCount, retryCount, regressions, providerLatency] = await Promise.all([
    prisma.run.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      take: 30,
      select: {
        id: true,
        averageScore: true,
        totalCost: true,
        failedCases: true,
        createdAt: true,
        modelName: true
      }
    }),
    prisma.usageEvent.aggregate({
      where: { workspaceId },
      _sum: { tokensIn: true, tokensOut: true, costEstimate: true }
    }),
    prisma.trace.count({ where: { workspaceId } }),
    prisma.runItem.count({ where: { workspaceId } }),
    prisma.runItem.count({ where: { workspaceId, status: "passed" } }),
    prisma.runItem.count({ where: { workspaceId, status: "failed" } }),
    prisma.runItem.count({ where: { workspaceId, retryCount: { gt: 0 } } }),
    prisma.systemEvent.count({ where: { workspaceId, action: "regression_detected" } }),
    prisma.modelCall.groupBy({
      by: ["provider", "modelName"],
      where: { workspaceId },
      _avg: { latencyMs: true },
      _sum: { costEstimate: true },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 5
    })
  ]);

  const scoredRuns = runs.filter((run) => run.averageScore !== null);
  const meanScore =
    scoredRuns.length > 0
      ? scoredRuns.reduce((sum, run) => sum + Number(run.averageScore), 0) / scoredRuns.length
      : 0;
  
  const commonErrors = await prisma.runItem.groupBy({
    by: ['errorMessage'],
    where: { workspaceId, status: 'failed', errorMessage: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 1
  });
  const failureHotspot = commonErrors[0]?.errorMessage?.slice(0, 32) || "No active hotspot";

  const totalCost =
    Number(usage._sum.costEstimate ?? 0) ||
    runs.reduce((sum, run) => sum + Number(run.totalCost ?? 0), 0);

  return {
    meanScore,
    failureHotspot,
    spend: totalCost,
    traceCoverage: itemCount > 0 ? traceCount / itemCount : 0,
    passRate: itemCount > 0 ? passedItems / itemCount : 0,
    failRate: itemCount > 0 ? failedItemCount / itemCount : 0,
    retryCount,
    regressionCount: regressions,
    providerLatency: providerLatency.map((row) => ({
      name: `${row.provider}/${row.modelName}`,
      latencyMs: Math.round(row._avg.latencyMs ?? 0),
      cost: Number(row._sum.costEstimate ?? 0),
      calls: row._count._all
    })),
    scoreTrend: runs.map((run) => ({
      name: run.createdAt.toISOString().slice(5, 10),
      score: Math.round(Number(run.averageScore ?? 0) * 100)
    }))
  };
}

function mapPrompt(row: {
  id: string;
  promptKey: string;
  title: string;
  versionNumber: number;
  status: string;
  provider: "gemini" | "groq" | "ollama";
  modelName: string;
  modelParamsJson: unknown;
  tags?: string[];
  changelog: string | null;
  updatedAt: Date;
  systemPrompt: string;
  userPromptTemplate: string;
  projectId: string;
}): PromptVersion {
  const params = row.modelParamsJson as { temperature?: number };
  return {
    id: row.id,
    key: row.promptKey,
    title: row.title,
    version: row.versionNumber,
    status: row.status as PromptVersion["status"],
    provider: row.provider,
    model: row.modelName,
    temperature: Number(params?.temperature ?? 0.2),
    tags: row.tags ?? [],
    lastRunScore: 0,
    changelog: row.changelog ?? "",
    updatedAt: row.updatedAt.toISOString(),
    systemPrompt: row.systemPrompt,
    userPromptTemplate: row.userPromptTemplate,
    projectId: row.projectId
  };
}

function mapDataset(row: {
  id: string;
  name: string;
  versionNumber: number;
  status: string;
  tags: string[];
  cases: Array<{
    id: string;
    inputPayloadJson: unknown;
    expectedOutputJson: unknown;
    tags: string[];
    difficulty: string;
    isActive: boolean;
  }>;
}): Dataset {
  return {
    id: row.id,
    name: row.name,
    version: row.versionNumber,
    status: row.status as Dataset["status"],
    tags: row.tags,
    coverage: row.cases.length > 0 ? 1 : 0,
    cases: row.cases.map((item) => ({
      id: item.id,
      name: `Case ${item.id.slice(0, 8)}`,
      input: JSON.stringify(item.inputPayloadJson),
      expected: JSON.stringify(item.expectedOutputJson ?? {}),
      tags: item.tags,
      difficulty: item.difficulty as "easy" | "medium" | "hard",
      status: item.isActive ? "active" : "inactive"
    }))
  };
}

export async function getFirstProjectId(workspaceId = DEMO_WORKSPACE_ID): Promise<string> {
  try {
    const project = await prisma.project.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: { id: true }
    });
    return project?.id ?? DEMO_PROJECT_ID;
  } catch {
    return DEMO_PROJECT_ID;
  }
}

function mapRunItemStatus(status: string) {
  if (status === "passed") return "pass";
  if (status === "failed") return "fail";
  if (status === "needs_review") return "needs_review";
  if (status === "retrying") return "retrying";
  if (status === "warning") return "warning";
  if (status === "running") return "running";
  return "queued";
}

function mapReviewStatus(status: string): ReviewItem["status"] {
  if (status === "passed") return "pass";
  if (status === "failed") return "fail";
  if (status === "needs_review") return "needs_review";
  if (status === "warning") return "warning";
  return "pending";
}

