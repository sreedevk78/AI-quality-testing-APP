import { Lock, Unlock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getComparisonPageData, getRunsPageData } from "@/server/page-data";
import { getPageRequestContext } from "@/server/page-context";
import { NewComparisonButton } from "@/components/comparisons/new-comparison-button";

export const dynamic = "force-dynamic";

export default async function ComparisonsPage() {
  const context = await getPageRequestContext();
  const [comparisonReports, runs] = await Promise.all([
    getComparisonPageData(context.workspaceId),
    getRunsPageData(context.workspaceId),
  ]);

  return (
    <AppShell>
      <PageTitle
        title="Comparisons and release gates"
        description="Baseline versus candidate quality, latency, cost, threshold status, and approval state for production-ready prompt versions."
        action={<NewComparisonButton runs={runs} />}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        {comparisonReports.length === 0 ? (
          <SectionCard title="No comparison reports">
            <div className="rounded-lg border border-dashed border-border bg-muted/25 p-8">
              <h2 className="font-semibold">Release gates need a baseline and candidate</h2>
              <p className="mt-2 text-sm text-muted-foreground">Run two evaluations, then create a comparison report to approve or block a prompt release.</p>
            </div>
          </SectionCard>
        ) : comparisonReports.map((report) => (
          <SectionCard
            key={report.id}
            title={`${report.baseline} -> ${report.candidate}`}
            action={<StatusBadge status={report.passFailStatus} />}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/25 p-4">
                <p className="text-xs text-muted-foreground">Score delta</p>
                <p className="mt-2 text-2xl font-semibold">{report.scoreDelta > 0 ? "+" : ""}{formatPercent(report.scoreDelta)}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/25 p-4">
                <p className="text-xs text-muted-foreground">Latency delta</p>
                <p className="mt-2 text-2xl font-semibold">{formatPercent(report.latencyDelta)}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/25 p-4">
                <p className="text-xs text-muted-foreground">Cost delta</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(report.costDelta)}</p>
              </div>
            </div>
            <div className="mt-5 rounded-lg border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="grid size-9 place-items-center rounded-md bg-primary/15 text-primary">
                  {report.passFailStatus === "pass" ? <Unlock size={18} /> : <Lock size={18} />}
                </div>
                <div>
                  <h2 className="font-semibold">
                    {report.passFailStatus === "pass" ? "Release gate unlocked" : "Release gate blocked"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Threshold is {formatPercent(report.threshold)}. Failed metrics must be reviewed before production approval.
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </AppShell>
  );
}
