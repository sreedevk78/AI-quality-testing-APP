"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { formatPercent } from "@/lib/utils";
import { GradingForm } from "./grading-form";
import type { ReviewItem } from "@/lib/types";

type GradingViewClientProps = {
  initialItems: ReviewItem[];
};

export function GradingViewClient({ initialItems }: GradingViewClientProps) {
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(initialItems[0]?.id || null);

  useEffect(() => {
    setItems(initialItems);
    setSelectedId((current) => (
      current && initialItems.some((item) => item.id === current)
        ? current
        : initialItems[0]?.id ?? null
    ));
  }, [initialItems]);

  const currentItems = items;
  const selectedItem = currentItems.find((i) => i.id === selectedId) || currentItems[0];

  function handleSuccess(id: string) {
    const newItems = currentItems.filter(i => i.id !== id);
    setItems(newItems);
    if (newItems.length > 0) {
      setSelectedId(newItems[0].id);
    } else {
      setSelectedId(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
      <div className="space-y-6">
        <SectionCard title="Awaiting human review">
          {currentItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/25 p-8 text-center">
              <h2 className="font-semibold">No items to review</h2>
              <p className="mt-2 text-sm text-muted-foreground">Run evaluations first - items with warnings, review flags, or failures will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentItems.map((item) => {
                const isSelected = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left block rounded-lg border p-4 transition-all hover:shadow-sm ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-muted/25 hover:border-primary/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">{item.caseName}</h2>
                        <p className="mt-1 text-xs text-muted-foreground">{item.run}</p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3 border-b border-border/50 pb-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-bold">Auto score</p>
                        <p className="mt-1 font-semibold">{formatPercent(item.score)}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Rubric</p>
                        <p className="mt-1 text-sm leading-relaxed">{item.rubric}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded border border-border bg-card/50 p-2">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">AI Response</p>
                        <pre className="text-xs whitespace-pre-wrap font-mono line-clamp-6 text-primary">{item.output}</pre>
                      </div>
                      <div className="rounded border border-border bg-card/50 p-2">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Expected Behavior</p>
                        <pre className="text-xs whitespace-pre-wrap font-mono line-clamp-6 text-muted-foreground">{item.expected}</pre>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="space-y-6">
        <SectionCard title="Review details">
          {selectedItem ? (
            <GradingForm
              runItemId={selectedItem.id}
              caseName={selectedItem.caseName}
              input={selectedItem.input}
              output={selectedItem.output}
              expected={selectedItem.expected}
              onSuccess={() => handleSuccess(selectedItem.id)}
            />
          ) : (
            <p className="text-sm text-muted-foreground italic">Select a review item from the queue.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
