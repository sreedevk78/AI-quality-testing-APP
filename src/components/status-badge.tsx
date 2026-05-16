import type { Status } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusClass: Record<string, string> = {
  pass: "border-success/35 bg-success/12 text-success",
  approved: "border-success/35 bg-success/12 text-success",
  warning: "border-warning/35 bg-warning/12 text-warning",
  fail: "border-danger/35 bg-danger/12 text-danger",
  queued: "border-muted-foreground/25 bg-muted text-muted-foreground",
  initializing: "border-primary/35 bg-primary/12 text-primary",
  running: "border-primary/35 bg-primary/12 text-primary",
  retrying: "border-warning/35 bg-warning/12 text-warning",
  partially_failed: "border-warning/35 bg-warning/12 text-warning",
  needs_review: "border-warning/35 bg-warning/12 text-warning",
  active: "border-primary/35 bg-primary/12 text-primary",
  draft: "border-muted-foreground/25 bg-muted text-muted-foreground",
  completed: "border-success/35 bg-success/12 text-success",
  failed: "border-danger/35 bg-danger/12 text-danger",
  cancelled: "border-muted-foreground/25 bg-muted text-muted-foreground"
};

export function StatusBadge({ status }: { status: Status | string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium capitalize",
        statusClass[status] ?? statusClass.queued
      )}
    >
      {status}
    </span>
  );
}
