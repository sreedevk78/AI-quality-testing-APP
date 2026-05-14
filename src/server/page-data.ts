import { prisma } from "@/lib/prisma";
import {
  comparisonReports,
  datasets,
  promptVersions,
  reviewQueue,
  runs,
  traceSpans
} from "@/lib/demo-data";
import type {
  ComparisonReport,
  Dataset,
  EvalRun,
  PromptVersion,
  ReviewItem,
  TraceSpan
} from "@/lib/types";
import { DEMO_WORKSPACE_ID, DEMO_PROJECT_ID } from "@/server/context";

const DB_TIMEOUT_MS = 8000;

export async function getDashboardData(workspaceId = DEMO_WORKSPACE_ID) {
  const data = await withFallback(
    async () => {
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
          status: run.status,
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
    },
    { runs, datasets, promptVersions }
  );

  return data;
}

export async function getPromptPageData(workspaceId = DEMO_WORKSPACE_ID) {
  return withFallback(
    async () => {
      const rows = await prisma.promptVersion.findMany({
        where: { workspaceId },
        orderBy: [{ promptKey: "asc" }, { versionNumber: "desc" }]
      });
      return rows.map(mapPrompt);
    },
    promptVersions
  );
}

export async function getDatasetPageData(workspaceId = DEMO_WORKSPACE_ID) {
  return withFallback(
    async () => {
      const rows = await prisma.dataset.findMany({
        where: { workspaceId },
        include: { cases: true },
        orderBy: { updatedAt: "desc" }
      });
      return rows.map(mapDataset);
    },
    datasets
  );
}

export async function getRunsPageData(workspaceId = DEMO_WORKSPACE_ID) {
  return withFallback(
    async () => {
      const rows = await prisma.run.findMany({
        where: { workspaceId },
        include: { items: { include: { datasetCase: true } } },
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
          status: run.status,
          progress: run.totalCases ? run.items.filter((item) => item.status !== "queued").length / run.totalCases : 0,
          averageScore: Number(run.averageScore ?? 0),
          totalCost: Number(run.totalCost),
          failures: run.failedCases,
          createdAt: run.createdAt.toISOString(),
          items: run.items.map((item) => ({
            id: item.id,
            caseName: String(item.datasetCase.inputPayloadJson),
            status: mapRunItemStatus(item.status),
            score: Number(item.score ?? 0),
            latencyMs: 0,
            cost: 0,
            traceId: item.id
          }))
        })
      );
    },
    runs
  );
}

export async function getTracePageData(workspaceId = DEMO_WORKSPACE_ID) {
  return withFallback(
    async () => {
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
    },
    traceSpans
  );
}

export async function getReviewPageData(workspaceId = DEMO_WORKSPACE_ID) {
  return withFallback(
    async () => {
      const rows = await prisma.runItem.findMany({
        where: { workspaceId, status: { in: ["warning", "failed"] } },
        include: { run: true, datasetCase: true },
        orderBy: { updatedAt: "desc" }
      });
      return rows.map(
        (item): ReviewItem => ({
          id: item.id,
          caseName: JSON.stringify(item.datasetCase.inputPayloadJson),
          run: item.run.modelName,
          score: Number(item.score ?? 0),
          rubric: JSON.stringify(item.datasetCase.rubricJson),
          status: "pending"
        })
      );
    },
    reviewQueue
  );
}

export async function getComparisonPageData(workspaceId = DEMO_WORKSPACE_ID) {
  return withFallback(
    async () => {
      const rows = await prisma.comparisonReport.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" }
      });
      return rows.map(
        (row): ComparisonReport => {
          const summary = row.metricSummaryJson as Record<string, number>;
          return {
            id: row.id,
            baseline: row.baselineId,
            candidate: row.candidateId,
            passFailStatus: row.passFailStatus === "pass" ? "pass" : "fail",
            scoreDelta: Number(summary.scoreDelta ?? 0),
            latencyDelta: Number(summary.latencyDelta ?? 0),
            costDelta: Number(summary.costDelta ?? 0),
            threshold: Number(summary.threshold ?? 0.85)
          };
        }
      );
    },
    comparisonReports
  );
}

export async function getAnalyticsPageData(workspaceId = DEMO_WORKSPACE_ID) {
  return withFallback(
    async () => {
      const [runs, usage, failedItems, traceCount, itemCount] = await Promise.all([
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
        prisma.runItem.findMany({
          where: { workspaceId, status: { in: ["warning", "failed"] } },
          orderBy: { updatedAt: "desc" },
          take: 50,
          select: { errorMessage: true }
        }),
        prisma.trace.count({ where: { workspaceId, status: "completed" } }),
        prisma.runItem.count({ where: { workspaceId } })
      ]);

      const scoredRuns = runs.filter((run) => run.averageScore !== null);
      const meanScore =
        scoredRuns.length > 0
          ? scoredRuns.reduce((sum, run) => sum + Number(run.averageScore), 0) / scoredRuns.length
          : 0;
      const failureLabel = failedItems[0]?.errorMessage?.slice(0, 28) || "No active hotspot";
      const totalCost =
        Number(usage._sum.costEstimate ?? 0) ||
        runs.reduce((sum, run) => sum + Number(run.totalCost ?? 0), 0);

      return {
        meanScore,
        failureHotspot: failureLabel,
        spend: totalCost,
        traceCoverage: itemCount > 0 ? traceCount / itemCount : 0,
        scoreTrend: runs.map((run) => ({
          name: run.createdAt.toISOString().slice(5, 10),
          score: Math.round(Number(run.averageScore ?? 0) * 100)
        }))
      };
    },
    {
      meanScore: 0,
      failureHotspot: "No active hotspot",
      spend: 0,
      traceCoverage: 0,
      scoreTrend: []
    }
  );
}

function mapPrompt(row: {
  id: string;
  promptKey: string;
  title: string;
  versionNumber: number;
  status: string;
  provider: "gemini" | "groq";
  modelName: string;
  modelParamsJson: unknown;
  tags?: string[];
  changelog: string | null;
  updatedAt: Date;
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
    updatedAt: row.updatedAt.toISOString()
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
  if (status === "warning") return "warning";
  if (status === "running") return "running";
  return "queued";
}

async function withFallback<T>(producer: () => Promise<T>, fallback: T): Promise<T> {
  const allowDemoFallback = process.env.APP_ALLOW_DEMO_FALLBACK === "1";

  if (process.env.APP_USE_DATABASE_READS !== "1" && allowDemoFallback) {
    return fallback;
  }

  try {
    return await Promise.race([
      producer(),
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error("Database read timed out")), DB_TIMEOUT_MS);
      })
    ]);
  } catch {
    if (!allowDemoFallback) {
      throw new Error("Database read failed and demo fallback is disabled.");
    }
    return fallback;
  }
}
