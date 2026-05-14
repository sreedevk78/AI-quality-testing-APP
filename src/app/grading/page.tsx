import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { formatPercent } from "@/lib/utils";
import { getReviewPageData } from "@/server/page-data";
import { getPageRequestContext } from "@/server/page-context";
import { GradingForm } from "@/components/grading/grading-form";

export const dynamic = "force-dynamic";

export default async function GradingPage() {
  const context = await getPageRequestContext();
  const reviewQueue = await getReviewPageData(context.workspaceId);
  const firstItem = reviewQueue[0];

  return (
    <AppShell>
      <PageTitle
        title="Grading queue"
        description="Human review and automated rubric scores flow into comparison metrics and release gates."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <SectionCard title="Awaiting human review">
          {reviewQueue.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/25 p-8">
              <h2 className="font-semibold">No items to review</h2>
              <p className="mt-2 text-sm text-muted-foreground">Run evaluations first — items with warnings or failures will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviewQueue.map((item) => (
                <div key={item.id} className="rounded-lg border border-border bg-muted/25 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{item.caseName}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{item.run}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div><p className="text-xs text-muted-foreground">Auto score</p><p className="mt-1 font-semibold">{formatPercent(item.score)}</p></div>
                    <div className="md:col-span-2"><p className="text-xs text-muted-foreground">Rubric</p><p className="mt-1 text-sm">{item.rubric}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
        <SectionCard title="Review modal">
          {firstItem ? (
            <GradingForm runItemId={firstItem.id} caseName={firstItem.caseName} />
          ) : (
            <p className="text-sm text-muted-foreground">Select a review item from the queue.</p>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
