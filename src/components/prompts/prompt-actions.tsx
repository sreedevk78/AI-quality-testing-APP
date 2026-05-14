"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopyPlus, CheckCircle2, Archive, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Modal, ModalActions } from "@/components/ui/modal";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/form-field";
import type { PromptVersion } from "@/lib/types";

type CreatePromptModalProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
};

export function CreatePromptModal({ open, onClose, projectId }: CreatePromptModalProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    promptKey: "",
    title: "",
    systemPrompt: "",
    userPromptTemplate: "",
    provider: "groq" as "groq" | "gemini",
    modelName: "llama-3.3-70b-versatile",
    temperature: 0.2,
  });

  const update = (key: string, value: string | number) => setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await api.post("/api/prompts", {
      projectId,
      promptKey: form.promptKey,
      title: form.title,
      systemPrompt: form.systemPrompt,
      userPromptTemplate: form.userPromptTemplate,
      provider: form.provider,
      modelName: form.modelName,
      modelParams: { temperature: form.temperature, topP: 1 },
      variablesSchema: {},
    });
    setLoading(false);
    if (result.ok) {
      success("Prompt version created");
      onClose();
      router.refresh();
    } else {
      error(result.error);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New prompt version" description="Creates an immutable version row. Edits require a new version." wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FieldWrapper label="Prompt Key" required>
            <Input required placeholder="support_triage" value={form.promptKey} onChange={(e) => update("promptKey", e.target.value)} />
          </FieldWrapper>
          <FieldWrapper label="Title" required>
            <Input required placeholder="Support Triage Agent" value={form.title} onChange={(e) => update("title", e.target.value)} />
          </FieldWrapper>
        </div>
        <FieldWrapper label="System Prompt" required>
          <Textarea required className="trace-font min-h-32" placeholder="You are a precise support triage evaluator..." value={form.systemPrompt} onChange={(e) => update("systemPrompt", e.target.value)} />
        </FieldWrapper>
        <FieldWrapper label="User Prompt Template" required>
          <Textarea required className="trace-font min-h-24" placeholder="Classify this request: {{message}}" value={form.userPromptTemplate} onChange={(e) => update("userPromptTemplate", e.target.value)} />
        </FieldWrapper>
        <div className="grid gap-4 md:grid-cols-3">
          <FieldWrapper label="Provider">
            <Select value={form.provider} onChange={(e) => update("provider", e.target.value)}>
              <option value="groq">Groq</option>
              <option value="gemini">Gemini</option>
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Model">
            <Input value={form.modelName} onChange={(e) => update("modelName", e.target.value)} />
          </FieldWrapper>
          <FieldWrapper label="Temperature">
            <Input type="number" step="0.1" min="0" max="2" value={form.temperature} onChange={(e) => update("temperature", Number(e.target.value))} />
          </FieldWrapper>
        </div>
        <ModalActions>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>
            <CopyPlus size={16} />
            Create Version
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

export function PromptActions({ prompt }: { prompt: PromptVersion }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  async function publish() {
    setLoading("publish");
    const result = await api.post(`/api/prompts/${prompt.id}/publish`);
    setLoading(null);
    if (result.ok) { success(`${prompt.title} v${prompt.version} published`); router.refresh(); }
    else error(result.error);
  }

  async function archive() {
    setLoading("archive");
    const result = await api.post(`/api/prompts/${prompt.id}/archive`);
    setLoading(null);
    if (result.ok) { success(`${prompt.title} v${prompt.version} archived`); router.refresh(); }
    else error(result.error);
  }

  return (
    <div className="mt-4 flex gap-2">
      {prompt.status !== "active" && prompt.status !== "approved" && (
        <Button variant="primary" onClick={publish} loading={loading === "publish"} className="text-xs px-2 py-1">
          <CheckCircle2 size={14} /> Publish
        </Button>
      )}
      {prompt.status !== "archived" && (
        <Button variant="secondary" onClick={archive} loading={loading === "archive"} className="text-xs px-2 py-1">
          <Archive size={14} /> Archive
        </Button>
      )}
    </div>
  );
}
