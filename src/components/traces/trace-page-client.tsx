"use client";

import { useState } from "react";
import { TraceSpanTree, SpanDetail } from "@/components/traces/trace-viewer";
import type { TraceSpan } from "@/lib/types";

export function TracePageClient({ traceSpans }: { traceSpans: TraceSpan[] }) {
  const [selectedId, setSelectedId] = useState(traceSpans[0]?.id ?? "");
  const selected = traceSpans.find((s) => s.id === selectedId);

  return (
    <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
      <section className="rounded-lg border border-border bg-card shadow-panel">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Timeline</h2>
        </div>
        <div className="p-4">
          <TraceSpanTree spans={traceSpans} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </section>
      <section className="rounded-lg border border-border bg-card shadow-panel">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Span detail</h2>
        </div>
        <div className="p-5">
          {selected ? (
            <SpanDetail span={selected} />
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/25 p-8">
              <h2 className="font-semibold">No traces captured</h2>
              <p className="mt-2 text-sm text-muted-foreground">Queued runs will persist trace spans for model calls, graders, retries, and failures.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
