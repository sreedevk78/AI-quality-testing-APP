import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { getPromptPageData, getFirstProjectId } from "@/server/page-data";
import { getPageRequestContext } from "@/server/page-context";
import { NewVersionButton } from "@/components/prompts/new-version-button";
import { PromptsPageClient } from "@/components/prompts/prompts-page-client";

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
      <PromptsPageClient initialPrompts={promptVersions} projectId={projectId} />
    </AppShell>
  );
}
