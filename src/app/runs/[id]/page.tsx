import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getPageRequestContext } from "@/server/page-context";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { runs as demoRuns } from "@/lib/demo-data";
import { RunDetailActions } from "@/components/runs/run-actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getRunDetail(workspaceId: string, runId: string) {
  if (!isDatabaseConfigured()) {
    const found = demoRuns.find((r) => r.id === runId);
    return found ?? demoRuns[0] ?? null;
  }
  try {
    const run = await prisma.run.findFirst({
      where: { id: runId, workspaceId },
      include: {
        promptVersion: { select: { title: true, versionNumber: true, promptKey: true } },
        dataset: { select: { name: true, versionNumber: true } },
        items: {
          include: {
            datasetCase: { select: { inputPayloadJson: true } },
            trace: { select: { id: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!run) return null;
    return {
      id: run.id,
      name: `${run.promptVersion?.title ?? run.modelName} v${run.promptVersion?.versionNumber ?? "?"}`,
      promptVersion: `${run.promptVersion?.title ?? "?"} v${run.promptVersion?.versionNumber ?? "?"}`,
      dataset: `${run.dataset?.name ?? "?"} v${run.dataset?.versionNumber ?? "?"}`,
      provider: run.provider as "groq" | "gemini",
      model: run.modelName,
      status: run.status as any,
      progress: run.totalCases > 0 ? (run.passedCases + run.failedCases) / run.totalCases : 0,
      averageScore: Number(run.averageScore ?? 0),
      totalCost: Number(run.totalCost ?? 0),
      failures: run.failedCases,
      createdAt: run.createdAt.toISOString(),
      items: run.items.map((item) => ({
        id: item.id,
        caseName: JSON.stringify(item.datasetCase?.inputPayloadJson ?? {}).slice(0, 60),
        status: mapStatus(item.status),
        score: Number(item.score ?? 0),
        latencyMs: 0,
        cost: 0,
        traceId: item.trace?.id ?? "",
      })),
    };
  } catch {
    return demoRuns[0] ?? null;
  }
}

function mapStatus(s: string) {
  if (s === "passed") return "pass" as const;
  if (s === "failed") return "fail" as const;
  if (s === "warning") return "warning" as const;
  return s as any;
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
      <PageTitle
        title={run.name}
        description={`${run.provider} / ${run.model} — ${run.dataset}`}
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
                        <Link href={`/traces/${item.traceId}`} className="text-primary hover:underline">{item.traceId.slice(0, 8)}…</Link>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
