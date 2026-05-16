import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { SectionCard } from "@/components/section-card";
import { createWorkspace } from "@/app/(auth)/auth-actions";

export default function OnboardingPage() {
  return (
    <AppShell>
      <PageTitle
        title="Create workspace"
        description="Set up the tenant boundary used by prompts, datasets, runs, traces, billing, and role-based access."
      />
      <SectionCard title="Workspace setup">
        <form action={createWorkspace} className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium">
            Workspace name
            <input name="name" className="focus-ring mt-2 w-full rounded-md border border-border bg-card px-3 py-2" placeholder="AI platform workspace" required />
          </label>
          <label className="block text-sm font-medium">
            Role
            <select name="role" className="focus-ring mt-2 w-full rounded-md border border-border bg-card px-3 py-2">
              <option>AI engineer</option>
              <option>Founder</option>
              <option>Reviewer</option>
            </select>
          </label>
          <label className="block text-sm font-medium md:col-span-2">
            Optional team invite
            <input name="inviteEmail" className="focus-ring mt-2 w-full rounded-md border border-border bg-card px-3 py-2" placeholder="teammate@example.com" />
          </label>
          <button type="submit" className="focus-ring rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground md:w-fit">
            Create Workspace
          </button>
        </form>
      </SectionCard>
    </AppShell>
  );
}
