"use client";

import { useState } from "react";
import { KeyRound, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldWrapper, Input, Select } from "@/components/ui/form-field";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import type { ProviderName } from "@/lib/types";

type CredentialView = {
  id: string;
  provider: ProviderName;
  displayName: string;
  status: "active" | "disabled" | "rotated";
  lastUsedAt: string | null;
  rotatedAt: string | null;
  updatedAt: string;
};

export function ProviderCredentialsManager({ initialCredentials }: { initialCredentials: CredentialView[] }) {
  const { success, error } = useToast();
  const [credentials, setCredentials] = useState(initialCredentials);
  const [loading, setLoading] = useState<string | null>(null);
  const [form, setForm] = useState({
    provider: "groq" as ProviderName,
    displayName: "default",
    secret: ""
  });

  async function saveCredential(e: React.FormEvent) {
    e.preventDefault();
    setLoading("save");
    const result = await api.post<CredentialView>("/api/settings/provider-credentials", form);
    setLoading(null);
    if (result.ok) {
      setCredentials((current) => [result.data, ...current.filter((item) => item.id !== result.data.id)]);
      setForm((current) => ({ ...current, secret: "" }));
      success("Provider credential saved");
    } else {
      error(result.error);
    }
  }

  async function revokeCredential(id: string) {
    setLoading(id);
    const result = await api.delete<{ id: string; status: "disabled" }>(`/api/settings/provider-credentials/${id}`);
    setLoading(null);
    if (result.ok) {
      setCredentials((current) => current.map((item) => item.id === id ? { ...item, status: result.data.status } : item));
      success("Provider credential disabled");
    } else {
      error(result.error);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={saveCredential} className="grid gap-3 rounded-lg border border-border bg-muted/25 p-4 md:grid-cols-[0.8fr_1fr_1.4fr_auto]">
        <FieldWrapper label="Provider">
          <Select value={form.provider} onChange={(e) => setForm((current) => ({ ...current, provider: e.target.value as ProviderName }))}>
            <option value="groq">Groq</option>
            <option value="gemini">Gemini</option>
            <option value="ollama">Ollama</option>
          </Select>
        </FieldWrapper>
        <FieldWrapper label="Name">
          <Input value={form.displayName} onChange={(e) => setForm((current) => ({ ...current, displayName: e.target.value }))} />
        </FieldWrapper>
        <FieldWrapper label="Secret or Ollama URL">
          <Input
            required
            type="password"
            autoComplete="off"
            placeholder="Stored encrypted on the server"
            value={form.secret}
            onChange={(e) => setForm((current) => ({ ...current, secret: e.target.value }))}
          />
        </FieldWrapper>
        <div className="flex items-end">
          <Button type="submit" loading={loading === "save"} className="w-full">
            <RotateCw size={16} />
            Save
          </Button>
        </div>
      </form>

      <div className="space-y-3">
        {credentials.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/25 p-5 text-sm text-muted-foreground">
            No encrypted workspace credentials have been saved. Server environment keys are still used as fallback.
          </div>
        ) : (
          credentials.map((credential) => (
            <div key={credential.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-md bg-primary/15 text-primary">
                  <KeyRound size={18} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold capitalize">{credential.provider} / {credential.displayName}</h3>
                  <p className="text-xs text-muted-foreground">
                    Last used {credential.lastUsedAt ? new Date(credential.lastUsedAt).toLocaleString() : "never"} / Updated {new Date(credential.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={credential.status === "active" ? "active" : "warning"} />
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 w-9 p-0"
                  disabled={credential.status !== "active"}
                  loading={loading === credential.id}
                  onClick={() => revokeCredential(credential.id)}
                  aria-label={`Disable ${credential.provider} credential`}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
