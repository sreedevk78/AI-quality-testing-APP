"use client";

import { useRouter } from "next/navigation";

export function DatasetSelector({
  datasets,
  selectedId
}: {
  datasets: Array<{ id: string; name: string }>;
  selectedId: string;
}) {
  const router = useRouter();

  if (datasets.length <= 1) return null;

  return (
    <select
      className="rounded border border-border bg-background px-2 py-1 text-xs"
      onChange={(event) => router.push(`/datasets?datasetId=${encodeURIComponent(event.target.value)}`)}
      value={selectedId}
      aria-label="Select dataset"
    >
      {datasets.map((dataset) => (
        <option key={dataset.id} value={dataset.id}>
          {dataset.name}
        </option>
      ))}
    </select>
  );
}
