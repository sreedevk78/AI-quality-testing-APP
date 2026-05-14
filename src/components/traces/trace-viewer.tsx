"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Clock, Cpu, Zap } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { TraceSpan } from "@/lib/types";

type TraceSpanViewerProps = {
  spans: TraceSpan[];
  selectedId?: string;
  onSelect: (id: string) => void;
};

export function TraceSpanTree({ spans, selectedId, onSelect }: TraceSpanViewerProps) {
  const roots = spans.filter((s) => !s.parentId);
  return (
    <div className="space-y-1">
      {roots.map((span) => (
        <SpanNode key={span.id} span={span} spans={spans} depth={0} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}

function SpanNode({ span, spans, depth, selectedId, onSelect }: {
  span: TraceSpan; spans: TraceSpan[]; depth: number; selectedId?: string; onSelect: (id: string) => void;
}) {
  const children = spans.filter((s) => s.parentId === span.id);
  const [expanded, setExpanded] = useState(true);
  const isSelected = selectedId === span.id;
  const typeIcon: Record<string, string> = { model: "🤖", tool: "🔧", guardrail: "🛡️", grader: "📏" };

  return (
    <div>
      <button
        onClick={() => { onSelect(span.id); if (children.length) setExpanded(!expanded); }}
        className={`focus-ring flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
          isSelected ? "bg-primary/15 border border-primary/30" : "hover:bg-muted/40 border border-transparent"
        }`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {children.length > 0 ? (
          expanded ? <ChevronDown size={14} className="shrink-0 text-muted-foreground" /> : <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
        ) : <span className="w-3.5 shrink-0" />}
        <span className="shrink-0">{typeIcon[span.type] ?? "⚡"}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{span.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{span.durationMs}ms</span>
        <StatusBadge status={span.status} />
      </button>
      {expanded && children.map((child) => (
        <SpanNode key={child.id} span={child} spans={spans} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}

export function SpanDetail({ span }: { span: TraceSpan }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{span.name}</h3>
        <StatusBadge status={span.status} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/25 p-3">
          <Clock size={16} className="text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="font-semibold">{span.durationMs} ms</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/25 p-3">
          <Cpu size={16} className="text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Tokens In</p>
            <p className="font-semibold">{span.tokensIn}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/25 p-3">
          <Zap size={16} className="text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Tokens Out</p>
            <p className="font-semibold">{span.tokensOut}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Raw input</p>
          <pre className="trace-font min-h-48 overflow-x-auto rounded-lg border border-border bg-muted/25 p-4 text-sm leading-6 whitespace-pre-wrap">{span.input}</pre>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Raw output</p>
          <pre className="trace-font min-h-48 overflow-x-auto rounded-lg border border-border bg-muted/25 p-4 text-sm leading-6 whitespace-pre-wrap">{span.output}</pre>
        </div>
      </div>
    </div>
  );
}
