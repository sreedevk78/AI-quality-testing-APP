import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { getTracePageData } from "@/server/page-data";
import { getPageRequestContext } from "@/server/page-context";
import { TracePageClient } from "@/components/traces/trace-page-client";

export const dynamic = "force-dynamic";

export default async function TracesPage() {
  const context = await getPageRequestContext();
  const traceSpans = await getTracePageData(context.workspaceId);
  return (
    <AppShell>
      <PageTitle
        title="Trace viewer"
        description="Inspect model spans, guardrails, tool calls, grader spans, raw input/output, timing, token usage, and nested metadata."
      />
      <TracePageClient traceSpans={traceSpans} />
    </AppShell>
  );
}
