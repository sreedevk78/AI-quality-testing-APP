import { GitCompare } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { formatPercent } from "@/lib/utils";
import { getPromptPageData, getFirstProjectId } from "@/server/page-data";
import { getPageRequestContext } from "@/server/page-context";
import { NewVersionButton } from "@/components/prompts/new-version-button";
import { PromptActions } from "@/components/prompts/prompt-actions";

export const dynamic = "force-dynamic";

export default async function PromptsPage() {
  const context = await getPageRequestContext();
  const [promptVersions, projectId] = await Promise.all([
    getPromptPageData(context.workspaceId),
    getFirstProjectId(context.workspaceId),
  ]);
  return (
    <AppShell>
      <PageTitle
        title="Prompt registry"
        description="Immutable prompt versions, model defaults, changelogs, tags, publishing state, and version comparison."
        action={<NewVersionButton projectId={projectId} />}
      />
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <SectionCard title="Version inventory">
          <div className="space-y-3">
            {promptVersions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/25 p-8">
                <h2 className="font-semibold">No prompt versions</h2>
                <p className="mt-2 text-sm text-muted-foreground">Create your first prompt version to start evaluating.</p>
              </div>
            ) : promptVersions.map((prompt) => (
              <div key={prompt.id} className="rounded-lg border border-border bg-muted/25 p-4">
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
                  <span className="col-span-2">{prompt.provider} / {prompt.model}</span>
                  <span className="text-muted-foreground">Temp</span>
                  <span className="col-span-2">{prompt.temperature}</span>
                  <span className="text-muted-foreground">Score</span>
                  <span className="col-span-2">{formatPercent(prompt.lastRunScore)}</span>
                </div>
                <PromptActions prompt={prompt} />
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard
          title="Editor and live preview"
          action={
            <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <GitCompare size={16} aria-hidden="true" />
              Compare
            </button>
          }
        >
          <div className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
            <div className="space-y-3 rounded-lg border border-border bg-muted/25 p-4">
              <label className="block text-sm font-medium" htmlFor="provider">Provider</label>
              <select id="provider" className="focus-ring w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
                <option>Groq</option>
                <option>Gemini</option>
              </select>
              <label className="block text-sm font-medium" htmlFor="model">Model</label>
              <input id="model" className="focus-ring w-full rounded-md border border-border bg-card px-3 py-2 text-sm" defaultValue="llama-3.3-70b-versatile" />
              <label className="block text-sm font-medium" htmlFor="temp">Temperature</label>
              <input id="temp" type="number" step="0.1" className="focus-ring w-full rounded-md border border-border bg-card px-3 py-2 text-sm" defaultValue="0.2" />
            </div>
            <div className="space-y-4">
              <textarea
                className="trace-font focus-ring min-h-64 w-full rounded-lg border border-border bg-card p-4 text-sm leading-6"
                defaultValue={`System: You are a precise support triage evaluator.\n\nUser template: {{customer_message}}\n\nReturn JSON with category, escalation, rationale, and confidence.`}
              />
              <div className="rounded-lg border border-border bg-muted/25 p-4">
                <p className="text-xs uppercase text-muted-foreground">Rendered preview</p>
                <pre className="trace-font mt-3 overflow-x-auto text-sm leading-6">{`{ "customer_message": "I was charged twice and need a refund now." }`}</pre>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
