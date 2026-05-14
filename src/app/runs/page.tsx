import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getRunsPageData, getPromptPageData, getDatasetPageData } from "@/server/page-data";
import { getPageRequestContext } from "@/server/page-context";
import { RunBuilderForm, RunDetailActions } from "@/components/runs/run-actions";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const context = await getPageRequestContext();
  const [runs, prompts, datasets] = await Promise.all([
    getRunsPageData(context.workspaceId),
    getPromptPageData(context.workspaceId),
    getDatasetPageData(context.workspaceId),
  ]);
  const run = runs[0];

  return (
    <AppShell>
      <PageTitle
        title="Run executor"
        description="Queue prompt/model evaluations across datasets, persist each run item, capture errors and timings, and retry failed cases."
      />
      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <SectionCard title="Run builder">
          <RunBuilderForm prompts={prompts} datasets={datasets} />
        </SectionCard>
        <SectionCard
          title="Run detail"
          action={run ? <RunDetailActions runId={run.id} status={run.status} /> : undefined}
        >
          {run ? (
            <>
              <div className="mb-5 grid gap-4 md:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">Status</p><div className="mt-2"><StatusBadge status={run.status} /></div></div>
                <div><p className="text-xs text-muted-foreground">Progress</p><p className="mt-2 font-semibold">{formatPercent(run.progress)}</p></div>
                <div><p className="text-xs text-muted-foreground">Average score</p><p className="mt-2 font-semibold">{formatPercent(run.averageScore)}</p></div>
                <div><p className="text-xs text-muted-foreground">Cost</p><p className="mt-2 font-semibold">{formatCurrency(run.totalCost)}</p></div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${run.progress * 100}%` }} />
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
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
                      <tr key={item.id}>
                        <td className="py-3 font-medium">
                          <Link href={`/runs/${run.id}`} className="hover:text-primary transition-colors">{item.caseName}</Link>
                        </td>
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
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/25 p-8">
              <h2 className="font-semibold">No runs queued</h2>
              <p className="mt-2 text-sm text-muted-foreground">Create a prompt version and dataset, then queue the first evaluation run.</p>
            </div>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
