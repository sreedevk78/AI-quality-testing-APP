import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getPageRequestContext } from "@/server/page-context";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { RunDetailActions } from "@/components/runs/run-actions";
import { LiveRunRefresh } from "@/components/runs/live-run-refresh";
import Link from "next/link";
import type { EvalRun, ProviderName, Status } from "@/lib/types";

export const dynamic = "force-dynamic";

type RunDetail = EvalRun & {
  statusEvents: Array<{ id: string; fromStatus: string | null; toStatus: string; reason: string | null; createdAt: string }>;
  jobs: Array<{ id: string; status: string; attempts: number; maxAttempts: number; lockedBy: string | null; errorMessage: string | null; updatedAt: string }>;
  events: Array<{ id: string; action: string; createdAt: string }>;
};

async function getRunDetail(workspaceId: string, runId: string): Promise<RunDetail | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }
  const run = await prisma.run.findFirst({
    where: { id: runId, workspaceId },
    include: {
      promptVersion: { select: { title: true, versionNumber: true, promptKey: true } },
      dataset: { select: { name: true, versionNumber: true } },
      items: {
        include: {
          datasetCase: { select: { inputPayloadJson: true } },
          trace: { select: { id: true, totalDurationMs: true, totalCost: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      statusEvents: {
        orderBy: { createdAt: "desc" },
        take: 12
      }
    },
  });
  if (!run) return null;
  const [jobs, events] = await Promise.all([
    prisma.backgroundJob.findMany({
      where: { workspaceId, jobType: "evaluate_run", payloadJson: { path: ["runId"], equals: runId } },
      orderBy: { updatedAt: "desc" },
      take: 8
    }),
    prisma.systemEvent.findMany({
      where: { workspaceId, entityType: "run", entityId: runId },
      orderBy: { createdAt: "desc" },
      take: 12
    })
  ]);
  const settledItems = run.items.filter((item) => (
    item.status === "passed" ||
    item.status === "failed" ||
    item.status === "warning" ||
    item.status === "needs_review" ||
    item.status === "cancelled"
  )).length;
  const history = [
    ...run.statusEvents.map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      reason: event.reason,
      createdAt: event.createdAt.toISOString()
    })),
    ...events.map((event) => ({
      id: event.id,
      fromStatus: null,
      toStatus: event.action,
      reason: "System event",
      createdAt: event.createdAt.toISOString()
    }))
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return {
    id: run.id,
    name: `${run.promptVersion?.title ?? run.modelName} v${run.promptVersion?.versionNumber ?? "?"}`,
    promptVersion: `${run.promptVersion?.title ?? "?"} v${run.promptVersion?.versionNumber ?? "?"}`,
    dataset: `${run.dataset?.name ?? "?"} v${run.dataset?.versionNumber ?? "?"}`,
    provider: run.provider as ProviderName,
    model: run.modelName,
    status: run.status as EvalRun["status"],
    progress: run.totalCases > 0 ? settledItems / run.totalCases : 0,
    averageScore: Number(run.averageScore ?? 0),
    totalCost: Number(run.totalCost ?? 0),
    failures: run.failedCases,
    createdAt: run.createdAt.toISOString(),
    items: run.items.map((item) => ({
      id: item.id,
      caseName: JSON.stringify(item.datasetCase?.inputPayloadJson ?? {}).slice(0, 60),
      status: mapStatus(item.status),
      score: Number(item.score ?? 0),
      latencyMs: item.trace?.totalDurationMs ?? 0,
      cost: Number(item.trace?.totalCost ?? 0),
      traceId: item.trace?.id ?? "",
    })),
    statusEvents: history.slice(0, 12),
    jobs: jobs.map((job) => ({
        id: job.id,
        status: job.status,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        lockedBy: job.lockedBy,
        errorMessage: job.errorMessage,
        updatedAt: job.updatedAt.toISOString()
      })),
    events: []
  };
}

function mapStatus(s: string): Status {
  if (s === "passed") return "pass" as const;
  if (s === "failed") return "fail" as const;
  if (s === "warning") return "warning" as const;
  if (s === "needs_review") return "needs_review";
  if (s === "retrying") return "retrying";
  if (s === "running") return "running";
  if (s === "cancelled") return "cancelled";
  return "queued";
}

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getPageRequestContext();
  const { id } = await params;
  const run = await getRunDetail(context.workspaceId, id);

  if (!run) {
    return (
      <AppShell>
        <PageTitle title="Run not found" description="This run does not exist or you do not have access." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <LiveRunRefresh 
        isActive={["queued", "initializing", "running", "retrying", "needs_review"].includes(run.status)} 
        pollUrl={`/api/runs/${run.id}/poll`} 
      />
      <PageTitle
        title={run.name}
        description={`${run.provider} / ${run.model} - ${run.dataset}`}
        action={<RunDetailActions runId={run.id} status={run.status} />}
      />
      <div className="grid gap-5 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4 shadow-panel">
          <p className="text-xs text-muted-foreground">Status</p>
          <div className="mt-2"><StatusBadge status={run.status} /></div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-panel">
          <p className="text-xs text-muted-foreground">Progress</p>
          <p className="mt-2 text-2xl font-semibold">{formatPercent(run.progress)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-panel">
          <p className="text-xs text-muted-foreground">Average Score</p>
          <p className="mt-2 text-2xl font-semibold">{formatPercent(run.averageScore)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-panel">
          <p className="text-xs text-muted-foreground">Cost</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(run.totalCost)}</p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${run.progress * 100}%` }} />
      </div>

      <div className="mt-6">
        <SectionCard title={`Run items (${run.items.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-3 font-medium">Case</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Score</th>
                  <th className="pb-3 font-medium">Latency</th>
                  <th className="pb-3 font-medium">Trace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {run.items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 font-medium max-w-xs truncate">{item.caseName}</td>
                    <td className="py-3"><StatusBadge status={item.status} /></td>
                    <td className="py-3">{formatPercent(item.score)}</td>
                    <td className="py-3">{item.latencyMs} ms</td>
                    <td className="py-3">
                      {item.traceId ? (
                        <Link href={`/traces/${item.traceId}`} className="text-primary hover:underline">{item.traceId.slice(0, 8)}...</Link>
                      ) : <span className="text-muted-foreground">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Job status">
          {run.jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No background jobs are attached to this run.</p>
          ) : (
            <div className="space-y-3">
              {run.jobs.map((job) => (
                <div key={job.id} className="rounded-lg border border-border bg-muted/25 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="trace-font text-xs">{job.id.slice(0, 8)}</span>
                    <StatusBadge status={job.status} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Attempts {job.attempts}/{job.maxAttempts} / Worker {job.lockedBy ?? "none"} / Updated {new Date(job.updatedAt).toLocaleString()}
                  </p>
                  {job.errorMessage && <p className="mt-2 text-xs text-danger">{job.errorMessage}</p>}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
        <SectionCard title="Status history">
          <div className="space-y-3">
            {run.statusEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-border bg-muted/25 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{event.fromStatus ? `${event.fromStatus} -> ${event.toStatus}` : event.toStatus}</span>
                  <span className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</span>
                </div>
                {event.reason && <p className="mt-1 text-xs text-muted-foreground">{event.reason}</p>}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
