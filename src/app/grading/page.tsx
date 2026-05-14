import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { formatPercent } from "@/lib/utils";
import { getReviewPageData, getGraderDefinitions } from "@/server/page-data";
import { getPageRequestContext } from "@/server/page-context";
import { GradingForm } from "@/components/grading/grading-form";
import { GraderManager } from "@/components/grading/grader-manager";
import { AutoGradeButton } from "@/components/grading/auto-grade-button";

export const dynamic = "force-dynamic";

export default async function GradingPage() {
  const context = await getPageRequestContext();
  const [reviewQueue, graderDefinitions] = await Promise.all([
    getReviewPageData(context.workspaceId),
    getGraderDefinitions(context.workspaceId)
  ]);
  const firstItem = reviewQueue[0];

  return (
    <AppShell>
      <PageTitle
        title="Grading queue"
        description="Human review and automated rubric scores flow into comparison metrics and release gates."
        action={<AutoGradeButton runId={firstItem?.runId} />}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <SectionCard title="Awaiting human review">
            {reviewQueue.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/25 p-8 text-center">
                <h2 className="font-semibold">No items to review</h2>
                <p className="mt-2 text-sm text-muted-foreground">Run evaluations first — items with warnings or failures will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviewQueue.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border bg-muted/25 p-4 transition-colors hover:border-primary/20">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">{item.caseName}</h2>
                        <p className="mt-1 text-xs text-muted-foreground">{item.run}</p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div><p className="text-xs text-muted-foreground uppercase font-bold">Auto score</p><p className="mt-1 font-semibold">{formatPercent(item.score)}</p></div>
                      <div className="md:col-span-2"><p className="text-xs text-muted-foreground uppercase font-bold">Rubric</p><p className="mt-1 text-sm leading-relaxed">{item.rubric}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Review details">
            {firstItem ? (
              <GradingForm runItemId={firstItem.id} caseName={firstItem.caseName} />
            ) : (
              <p className="text-sm text-muted-foreground italic">Select a review item from the queue.</p>
            )}
          </SectionCard>

          <SectionCard title="Configured Graders">
            <GraderManager initialDefinitions={graderDefinitions} />
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
