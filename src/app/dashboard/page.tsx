import { AlertTriangle, CheckCircle2, CircleDollarSign, Gauge } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { MetricCard } from "@/components/metric-card";
import { PageTitle } from "@/components/page-title";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getDashboardData } from "@/server/page-data";
import { getPageRequestContext } from "@/server/page-context";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const context = await getPageRequestContext();
  const { runs, datasets, promptVersions } = await getDashboardData(context.workspaceId);
  const latest = runs[0] ?? {
    id: "empty-run",
    name: "No runs queued",
    model: "No model selected",
    status: "queued" as const,
    averageScore: 0,
    totalCost: 0,
    failures: 0,
    createdAt: "",
    progress: 0,
    promptVersion: "",
    dataset: "",
    provider: "groq" as const,
    items: []
  };
  const coverage = datasets[0]?.coverage ?? 0;

  return (
    <AppShell>
      <PageTitle
        title="Evaluation dashboard"
        description="Workspace health, recent regressions, dataset coverage, and release readiness for prompt and agent workflows."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Latest score" value={formatPercent(latest.averageScore)} detail={latest.name} icon={<Gauge size={18} />} />
        <MetricCard label="Open failures" value={String(latest.failures)} detail="Across recent completed runs" icon={<AlertTriangle size={18} />} />
        <MetricCard label="Dataset coverage" value={formatPercent(coverage)} detail="Active evaluation suites" icon={<CheckCircle2 size={18} />} />
        <MetricCard label="Run cost" value={formatCurrency(latest.totalCost)} detail="Last completed batch" icon={<CircleDollarSign size={18} />} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <SectionCard
          title="Recent runs"
          action={
            <Link className="text-sm font-medium text-primary" href="/runs">
              View all
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-3 font-medium">Run</th>
                  <th className="pb-3 font-medium">Model</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Score</th>
                  <th className="pb-3 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="py-3">
                      <div className="font-medium">{run.name}</div>
                      <div className="text-xs text-muted-foreground">{run.createdAt}</div>
                    </td>
                    <td className="py-3 text-muted-foreground">{run.model}</td>
                    <td className="py-3"><StatusBadge status={run.status} /></td>
                    <td className="py-3">{formatPercent(run.averageScore)}</td>
                    <td className="py-3">{formatCurrency(run.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Onboarding checklist">
          <div className="space-y-3">
            {[
              "Create or import a prompt version",
              "Attach a dataset with expected behavior",
              "Run baseline and candidate evaluations",
              "Review traces and approve the release gate"
            ].map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-md border border-border bg-muted/35 p-3">
                <span className="grid size-7 place-items-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {promptVersions.map((prompt) => (
          <section key={prompt.id} className="rounded-lg border border-border bg-card p-4 shadow-panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{prompt.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{prompt.key} v{prompt.version}</p>
              </div>
              <StatusBadge status={prompt.status} />
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{prompt.changelog}</p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span>{prompt.provider} / {prompt.model}</span>
              <span className="font-medium">{formatPercent(prompt.lastRunScore)}</span>
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
