"use client";

import { useRouter } from "next/navigation";

export function RunSelector({
  runs,
  selectedId
}: {
  runs: Array<{ id: string; name: string; createdAt: string }>;
  selectedId: string;
}) {
  const router = useRouter();

  if (runs.length <= 1) return null;

  return (
    <select
      className="rounded border border-border bg-background px-2 py-1 text-xs"
      onChange={(event) => router.push(`/runs?runId=${encodeURIComponent(event.target.value)}`)}
      value={selectedId}
      aria-label="Select run"
    >
      {runs.map((run) => (
        <option key={run.id} value={run.id}>
          {run.name} ({new Date(run.createdAt).toLocaleDateString()})
        </option>
      ))}
    </select>
  );
}
