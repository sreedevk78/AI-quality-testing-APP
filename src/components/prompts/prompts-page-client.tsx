"use client";

import { useState } from "react";
import { GitCompare } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { formatPercent } from "@/lib/utils";
import { PromptActions } from "@/components/prompts/prompt-actions";
import { PromptEditor } from "@/components/prompts/prompt-editor";
import type { PromptVersion } from "@/lib/types";

export function PromptsPageClient({ initialPrompts }: { initialPrompts: PromptVersion[] }) {
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(initialPrompts[0]?.id ?? null);
  const selectedPrompt = initialPrompts.find(p => p.id === selectedPromptId);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_2.15fr]">
      <SectionCard title="Version inventory">
        <div className="space-y-3">
          {initialPrompts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/25 p-8 text-center">
              <h2 className="font-semibold">No prompt versions</h2>
              <p className="mt-2 text-sm text-muted-foreground">Create your first prompt version to start.</p>
            </div>
          ) : initialPrompts.map((prompt) => (
            <div 
              key={prompt.id} 
              onClick={() => setSelectedPromptId(prompt.id)}
              className={`cursor-pointer rounded-lg border p-4 transition-all ${
                selectedPromptId === prompt.id 
                ? "border-primary bg-primary/5 shadow-sm" 
                : "border-border bg-muted/25 hover:border-muted-foreground/30"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{prompt.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{prompt.key} / v{prompt.version}</p>
                </div>
                <StatusBadge status={prompt.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {prompt.tags.map((tag) => (
                  <span key={tag} className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <span className="text-muted-foreground">Model</span>
                <span className="col-span-2 truncate">{prompt.provider} / {prompt.model}</span>
                <span className="text-muted-foreground">Score</span>
                <span className="col-span-2">{formatPercent(prompt.lastRunScore)}</span>
              </div>
              <PromptActions prompt={prompt} />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Editor and live preview">
        <PromptEditor initialPrompt={selectedPrompt} />
      </SectionCard>
    </div>
  );
}
