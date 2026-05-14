import { KeyRound, Shield, CreditCard, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageTitle } from "@/components/page-title";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { BillingButton } from "@/components/settings/billing-button";

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
        <div className="space-y-6">
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
                <h2 className="font-semibold">Workspace isolation</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Prisma schema and Supabase RLS policies enforce workspace membership boundaries and server-only service-role access.
                </p>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Subscription and billing">
            <div className="rounded-lg border border-border bg-muted/25 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold">Pro Plan</h3>
                  <p className="text-sm text-muted-foreground">$49 / month per workspace</p>
                </div>
                <StatusBadge status="warning" />
              </div>
              <ul className="space-y-3 mb-6">
                {[
                  "Unlimited evaluation runs",
                  "Automated LLM-as-a-judge",
                  "30-day trace retention",
                  "Advanced comparison charts",
                  "Priority support"
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 size={14} className="text-primary" /> {feature}
                  </li>
                ))}
              </ul>
              <BillingButton />
            </div>
          </SectionCard>
          
          <SectionCard title="Usage quotas">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                   <span className="text-muted-foreground font-medium uppercase">Monthly Traces</span>
                   <span className="font-bold">1,240 / 10,000</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                   <div className="h-full bg-primary" style={{ width: '12.4%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                   <span className="text-muted-foreground font-medium uppercase">Stored Datasets</span>
                   <span className="font-bold">8 / 50</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                   <div className="h-full bg-primary" style={{ width: '16%' }} />
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
