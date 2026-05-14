import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { PageTitle } from "@/components/page-title";
import { ScoreChart } from "@/components/score-chart";
import { SectionCard } from "@/components/section-card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getAnalyticsPageData } from "@/server/page-data";
import { getPageRequestContext } from "@/server/page-context";
import { AlertTriangle, CircleDollarSign, Gauge, SearchCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const context = await getPageRequestContext();
  const analytics = await getAnalyticsPageData(context.workspaceId);

  return (
    <AppShell>
      <PageTitle
        title="Analytics and observability"
        description="Score distributions, cost summaries, failure hotspots, model comparison, audit visibility, and workspace health."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Mean score" value={formatPercent(analytics.meanScore)} detail="Recent scored runs" icon={<Gauge size={18} />} />
        <MetricCard label="Failure hotspot" value={analytics.failureHotspot} detail="Latest warning or failure" icon={<AlertTriangle size={18} />} />
        <MetricCard label="Spend" value={formatCurrency(analytics.spend)} detail="Recorded provider usage" icon={<CircleDollarSign size={18} />} />
        <MetricCard label="Trace coverage" value={formatPercent(analytics.traceCoverage)} detail="Run items with completed traces" icon={<SearchCheck size={18} />} />
      </div>
      <div className="mt-6">
        <SectionCard title="Score trend">
          <ScoreChart data={analytics.scoreTrend} />
        </SectionCard>
      </div>
    </AppShell>
  );
}
