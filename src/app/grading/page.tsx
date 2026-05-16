import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { SectionCard } from "@/components/section-card";
import { getReviewPageData, getGraderDefinitions } from "@/server/page-data";
import { getPageRequestContext } from "@/server/page-context";
import { GraderManager } from "@/components/grading/grader-manager";
import { AutoGradeButton } from "@/components/grading/auto-grade-button";
import { LiveRunRefresh } from "@/components/runs/live-run-refresh";
import { GradingViewClient } from "@/components/grading/grading-view-client";

export const dynamic = "force-dynamic";

export default async function GradingPage() {
  const context = await getPageRequestContext();
  const [reviewQueue, graderDefinitions] = await Promise.all([
    getReviewPageData(context.workspaceId),
    getGraderDefinitions(context.workspaceId)
  ]);
  
  return (
    <AppShell>
      <LiveRunRefresh isActive={reviewQueue.length > 0} />
      <PageTitle
        title="Grading queue"
        description="Human review and automated rubric scores flow into comparison metrics and release gates."
        action={<AutoGradeButton runId={reviewQueue[0]?.runId} />}
      />
      
      <GradingViewClient initialItems={reviewQueue} />

      <div className="mt-8">
        <SectionCard title="Configured Graders">
          <GraderManager initialDefinitions={graderDefinitions} />
        </SectionCard>
      </div>
    </AppShell>
  );
}
