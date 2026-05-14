"use client";

import { useState, useEffect } from "react";
import { Play, Save, Code, Variable } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/form-field";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import type { PromptVersion } from "@/lib/types";

export function PromptEditor({ initialPrompt }: { initialPrompt?: PromptVersion }) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const [form, setForm] = useState({
    title: initialPrompt?.title ?? "",
    systemPrompt: initialPrompt?.systemPrompt ?? "You are a precise AI assistant.",
    userPromptTemplate: initialPrompt?.userPromptTemplate ?? "Hello, {{name}}!",
    provider: (initialPrompt?.provider as "groq" | "gemini") ?? "groq",
    modelName: initialPrompt?.model ?? "llama-3.3-70b-versatile",
    temperature: initialPrompt?.temperature ?? 0.2,
  });

  const [testVariables, setTestVariables] = useState<Record<string, string>>({
    name: "World",
  });
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (initialPrompt) {
      setForm({
        title: initialPrompt.title,
        systemPrompt: initialPrompt.systemPrompt,
        userPromptTemplate: initialPrompt.userPromptTemplate,
        provider: initialPrompt.provider as any,
        modelName: initialPrompt.model,
        temperature: initialPrompt.temperature,
      });
    }
  }, [initialPrompt]);

  const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const renderedPreview = () => {
    let template = form.userPromptTemplate;
    Object.entries(testVariables).forEach(([key, val]) => {
      template = template.replace(new RegExp(`{{${key}}}`, 'g'), val);
    });
    return template;
  };

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const fullPrompt = `${form.systemPrompt}\n\n${renderedPreview()}`;
    const result = await api.post<any>("/api/providers/test", {
      provider: form.provider,
      model: form.modelName,
      prompt: fullPrompt,
    });
    setTesting(false);
    if (result.ok) {
      setTestResult(result.data.text);
    } else {
      error(result.error);
    }
  }

  async function handleSave() {
    setLoading(true);
    const result = await api.post("/api/prompts", {
      ...form,
      promptKey: initialPrompt?.key ?? "manual_prompt",
      projectId: initialPrompt?.projectId ?? "demo",
      variablesSchema: {}, // Optional for now
    });
    setLoading(false);
    if (result.ok) {
      success("New version saved");
    } else {
      error(result.error);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[0.35fr_1.65fr]">
      {/* Parameters Panel */}
      <div className="space-y-4 rounded-lg border border-border bg-muted/25 p-4">
        <h3 className="text-xs font-bold uppercase text-muted-foreground">Parameters</h3>
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
          <Input type="number" step="0.1" value={form.temperature} onChange={(e) => update("temperature", parseFloat(e.target.value))} />
        </FieldWrapper>
        
        <div className="pt-4 border-t border-border">
          <h3 className="mb-3 text-xs font-bold uppercase text-muted-foreground">Test Variables</h3>
          {Object.entries(testVariables).map(([key, val]) => (
            <FieldWrapper key={key} label={key}>
              <Input value={val} onChange={(e) => setTestVariables(prev => ({ ...prev, [key]: e.target.value }))} />
            </FieldWrapper>
          ))}
          <Button variant="ghost" className="w-full text-xs" onClick={() => {
            const key = prompt("Variable name?");
            if (key) setTestVariables(prev => ({ ...prev, [key]: "" }));
          }}>
            <Variable size={12} className="mr-1" /> Add Variable
          </Button>
        </div>
      </div>

      {/* Editor & Preview Panel */}
      <div className="space-y-4">
        <div className="flex gap-2 justify-end mb-2">
           <Button variant="secondary" onClick={handleTest} loading={testing}>
            <Play size={14} className="mr-1" /> Run Test
          </Button>
          <Button onClick={handleSave} loading={loading}>
            <Save size={14} className="mr-1" /> Save Version
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
           <div className="space-y-4">
            <FieldWrapper label="System Prompt">
              <Textarea 
                className="trace-font min-h-[200px]" 
                value={form.systemPrompt} 
                onChange={(e) => update("systemPrompt", e.target.value)} 
              />
            </FieldWrapper>
            <FieldWrapper label="User Template">
              <Textarea 
                className="trace-font min-h-[150px]" 
                value={form.userPromptTemplate} 
                onChange={(e) => update("userPromptTemplate", e.target.value)} 
              />
            </FieldWrapper>
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-muted-foreground flex items-center">
                <Code size={12} className="mr-1" /> Rendered Preview
              </p>
              <div className="rounded-lg border border-border bg-muted/25 p-4 min-h-[100px]">
                <pre className="trace-font text-sm whitespace-pre-wrap">{renderedPreview()}</pre>
              </div>
            </div>

            {testResult && (
              <div className="animate-slide-up">
                <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Model Response</p>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 min-h-[150px]">
                  <p className="text-sm leading-6">{testResult}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
