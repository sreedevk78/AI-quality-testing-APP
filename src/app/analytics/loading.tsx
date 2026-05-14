import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { TableSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AppShell>
      <PageTitle title="Loading..." description="Preparing your evaluation data..." />
      <div className="rounded-lg border border-border bg-card p-6 shadow-panel">
        <TableSkeleton rows={8} cols={5} />
      </div>
    </AppShell>
  );
}
