import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AppShell>
      <PageTitle title="Loading..." description="Fetching latest data from the registry..." />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="space-y-4">
           <div className="rounded-lg border border-border p-6 h-[400px]">
             <Skeleton className="h-full w-full" />
           </div>
        </div>
      </div>
    </AppShell>
  );
}
