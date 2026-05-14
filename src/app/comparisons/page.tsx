import { Lock, Unlock, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getComparisonPageData, getRunsPageData } from "@/server/page-data";
import { getPageRequestContext } from "@/server/page-context";
import { NewComparisonButton } from "@/components/comparisons/new-comparison-button";
import { MetricDiffChart } from "@/components/comparisons/metric-diff-chart";
import { ApproveReleaseButton } from "@/components/comparisons/comparison-actions";

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
            <div className="rounded-lg border border-dashed border-border bg-muted/25 p-8 text-center">
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
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <div className="rounded-lg border border-border bg-muted/25 p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  Score {report.scoreDelta >= 0 ? <ArrowUpRight size={10} className="text-success" /> : <ArrowDownRight size={10} className="text-danger" />}
                </p>
                <p className={`mt-2 text-2xl font-semibold ${report.scoreDelta >= 0 ? "text-success" : "text-danger"}`}>
                  {report.scoreDelta > 0 ? "+" : ""}{formatPercent(report.scoreDelta)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/25 p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                   Latency {report.latencyDelta <= 0 ? <ArrowDownRight size={10} className="text-success" /> : <ArrowUpRight size={10} className="text-danger" />}
                </p>
                <p className={`mt-2 text-2xl font-semibold ${report.latencyDelta <= 0 ? "text-success" : "text-danger"}`}>
                  {formatPercent(report.latencyDelta)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/25 p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                   Cost {report.costDelta <= 0 ? <ArrowDownRight size={10} className="text-success" /> : <ArrowUpRight size={10} className="text-danger" />}
                </p>
                <p className={`mt-2 text-2xl font-semibold ${report.costDelta <= 0 ? "text-success" : "text-danger"}`}>
                  {formatCurrency(report.costDelta)}
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 mb-6 p-4 rounded-lg border border-border bg-muted/10">
               <MetricDiffChart title="Quality Distribution" baseline={report.baselineScore} candidate={report.candidateScore} />
               <MetricDiffChart title="Cost Performance" baseline={1} candidate={1 - (report.costDelta / Math.max(0.01, report.baselineScore + Math.abs(report.costDelta)))} unit="pts" />
            </div>

            <div className="mt-5 rounded-lg border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="grid size-9 place-items-center rounded-md bg-primary/15 text-primary">
                  {report.passFailStatus === "pass" ? <Unlock size={18} /> : <Lock size={18} />}
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold">
                    {report.passFailStatus === "pass" ? "Release gate unlocked" : "Release gate blocked"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Threshold is {formatPercent(report.threshold)}. {report.passFailStatus === "pass" ? "Ready for production approval." : "Improve candidate metrics to pass."}
                  </p>
                </div>
                {report.passFailStatus === "pass" && report.candidatePromptVersionId && (
                  <ApproveReleaseButton 
                    reportId={report.id} 
                    promptVersionId={report.candidatePromptVersionId} 
                    runId={report.candidateRunId} 
                  />
                )}
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </AppShell>
  );
}
