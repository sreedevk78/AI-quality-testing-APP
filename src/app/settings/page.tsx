import { KeyRound, Shield } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const groqConfigured = Boolean(process.env.GROQ_API_KEY);
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);

  return (
    <AppShell>
      <PageTitle
        title="Settings"
        description="Workspace members, model defaults, server-only API key status, billing, quotas, and security controls."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Provider credentials">
          <div className="space-y-4">
            {[
              { name: "Groq", configured: groqConfigured, env: "GROQ_API_KEY" },
              { name: "Gemini", configured: geminiConfigured, env: "GEMINI_API_KEY" }
            ].map((item) => (
              <div key={item.env} className="flex items-center justify-between rounded-lg border border-border bg-muted/25 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-md bg-primary/15 text-primary">
                    <KeyRound size={18} aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="font-semibold">{item.name}</h2>
                    <p className="text-sm text-muted-foreground">{item.env} is read only on the server</p>
                  </div>
                </div>
                <StatusBadge status={item.configured ? "active" : "warning"} />
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Security model">
          <div className="flex gap-4 rounded-lg border border-border bg-muted/25 p-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
              <Shield size={18} aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold">Workspace-scoped authorization</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Prisma schema and Supabase RLS policies enforce workspace membership boundaries, reviewer permissions, and server-only service-role access.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
