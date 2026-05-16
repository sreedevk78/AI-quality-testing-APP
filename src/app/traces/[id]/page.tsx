import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { getPageRequestContext } from "@/server/page-context";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { TracePageClient } from "@/components/traces/trace-page-client";
import { LiveRunRefresh } from "@/components/runs/live-run-refresh";
import type { Status, TraceSpan } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getTraceDetail(workspaceId: string, traceId: string): Promise<{ spans: TraceSpan[]; traceKey: string }> {
  if (!isDatabaseConfigured()) {
    return { spans: [], traceKey: traceId };
  }
  const trace = await prisma.trace.findFirst({
    where: { id: traceId, workspaceId },
    include: { spans: { orderBy: { createdAt: "asc" } } },
  });
  if (!trace) return { spans: [], traceKey: traceId };
  return {
    traceKey: trace.traceKey,
    spans: trace.spans.map((s) => ({
      id: s.id,
      parentId: s.parentSpanId ?? undefined,
      type: s.spanType as TraceSpan["type"],
      name: s.name,
      status: mapTraceStatus(s.status),
      durationMs: s.durationMs ?? 0,
      tokensIn: s.tokensIn ?? 0,
      tokensOut: s.tokensOut ?? 0,
      input: typeof s.inputJson === "string" ? s.inputJson : JSON.stringify(s.inputJson, null, 2),
      output: typeof s.outputJson === "string" ? s.outputJson : JSON.stringify(s.outputJson, null, 2),
    })),
  };
}

function mapTraceStatus(status: string): Status {
  if (status === "passed") return "pass";
  if (status === "failed") return "fail";
  if (status === "needs_review") return "needs_review";
  if (status === "retrying") return "retrying";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  if (status === "running") return "running";
  return "queued";
}

export default async function TraceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getPageRequestContext();
  const { id } = await params;
  const { spans, traceKey } = await getTraceDetail(context.workspaceId, id);

  return (
    <AppShell>
      <LiveRunRefresh isActive={spans.some((span) => span.status === "running" || span.status === "retrying")} />
      <PageTitle
        title={`Trace: ${traceKey}`}
        description={`${spans.length} span(s) captured. Click any span to inspect raw input/output, latency, and token usage.`}
      />
      <TracePageClient traceSpans={spans} />
    </AppShell>
  );
}
