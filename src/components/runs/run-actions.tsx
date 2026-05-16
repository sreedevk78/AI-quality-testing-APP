"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, RotateCcw, Square, Download } from "lucide-react";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { FieldWrapper, Input, Select } from "@/components/ui/form-field";
import type { PromptVersion, Dataset } from "@/lib/types";

type RunBuilderProps = {
  prompts: PromptVersion[];
  datasets: Dataset[];
};

type RunProvider = "groq" | "gemini" | "ollama";
const defaultModels: Record<RunProvider, string> = {
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.5-flash",
  ollama: "llama3.1"
};

export function RunBuilderForm({ prompts, datasets }: RunBuilderProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    promptVersionId: prompts[0]?.id ?? "",
    datasetId: datasets[0]?.id ?? "",
    provider: "groq" as RunProvider,
    modelName: defaultModels.groq,
    temperature: 0.2,
    graderDefinitionId: "",
  });

  const update = (key: string, value: string | number) => setForm((prev) => ({ ...prev, [key]: value }));
  const updateProvider = (provider: RunProvider) => {
    setForm((prev) => ({
      ...prev,
      provider,
      modelName: defaultModels[provider]
    }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.promptVersionId || !form.datasetId) {
      error("Select a prompt version and dataset");
      return;
    }
    setLoading(true);
    const result = await api.post<{ id: string }>("/api/runs", {
      promptVersionId: form.promptVersionId,
      datasetId: form.datasetId,
      provider: form.provider,
      modelName: form.modelName,
      temperature: form.temperature,
      graderDefinitionId: form.graderDefinitionId || undefined,
    });
    setLoading(false);
    if (result.ok) {
      success("Evaluation run queued");
      router.push(`/runs/${result.data.id}`);
    } else {
      error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <FieldWrapper label="Prompt version" required>
        <Select value={form.promptVersionId} onChange={(e) => update("promptVersionId", e.target.value)}>
          {prompts.length === 0 && <option value="">No prompts available</option>}
          {prompts.map((p) => (
            <option key={p.id} value={p.id}>{p.title} v{p.version} ({p.status})</option>
          ))}
        </Select>
      </FieldWrapper>
      <FieldWrapper label="Dataset" required>
        <Select value={form.datasetId} onChange={(e) => update("datasetId", e.target.value)}>
          {datasets.length === 0 && <option value="">No datasets available</option>}
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>{d.name} v{d.version}</option>
          ))}
        </Select>
      </FieldWrapper>
      <FieldWrapper label="Provider">
        <Select value={form.provider} onChange={(e) => updateProvider(e.target.value as RunProvider)}>
          <option value="groq">Groq</option>
          <option value="gemini">Gemini</option>
          <option value="ollama">Ollama</option>
        </Select>
      </FieldWrapper>
      <FieldWrapper label="Model">
        <Input value={form.modelName} onChange={(e) => update("modelName", e.target.value)} />
      </FieldWrapper>
      <FieldWrapper label="Temperature">
        <Input type="number" step="0.1" min="0" max="2" value={form.temperature} onChange={(e) => update("temperature", Number(e.target.value))} />
      </FieldWrapper>
      <Button type="submit" className="w-full" loading={loading}>
        <Play size={16} /> Queue Evaluation
      </Button>
    </form>
  );
}

export function RunDetailActions({ runId, status }: { runId: string; status: string }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  async function retryFailed() {
    setLoading("retry");
    const result = await api.post(`/api/runs/${runId}/retry-failed`);
    setLoading(null);
    if (result.ok) { success("Failed cases requeued"); router.refresh(); }
    else error(result.error);
  }

  async function cancel() {
    setLoading("cancel");
    const result = await api.post(`/api/runs/${runId}/cancel`);
    setLoading(null);
    if (result.ok) { success("Run cancelled"); router.refresh(); }
    else error(result.error);
  }

  async function exportRun() {
    setLoading("export");
    const result = await api.download(`/api/runs/${runId}/export`, `${runId}.json`);
    setLoading(null);
    if (result.ok) success("Run exported");
    else error(result.error);
  }

  return (
    <div className="flex gap-2">
      {(status === "completed" || status === "failed" || status === "partially_failed" || status === "needs_review") && (
        <Button variant="secondary" onClick={retryFailed} loading={loading === "retry"}>
          <RotateCcw size={16} /> Retry Failed
        </Button>
      )}
      {(status === "queued" || status === "initializing" || status === "running" || status === "retrying") && (
        <Button variant="secondary" onClick={cancel} loading={loading === "cancel"}>
          <Square size={16} /> Cancel
        </Button>
      )}
      <Button variant="secondary" onClick={exportRun} loading={loading === "export"}>
        <Download size={16} /> Export
      </Button>
    </div>
  );
}
