"use client";

import { useState } from "react";
import { Plus, Trash2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalActions } from "@/components/ui/modal";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/form-field";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";

export function GraderManager({ initialDefinitions }: { initialDefinitions: any[] }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    provider: "groq",
    modelName: "llama-3.3-70b-versatile",
    promptTemplate: "Evaluate the following output against the rubric.\n\nOutput: {{output}}\n\nRubric: {{rubric}}\n\nReturn JSON with score (0.0 to 1.0), label, and rationale."
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await api.post("/api/grading/definitions", { ...form, type: "llm_rubric" });
    setLoading(false);
    if (result.ok) {
      success("Grader definition created");
      setOpen(false);
      router.refresh();
    } else {
      error(result.error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this grader? This will not delete past results.")) return;
    const result = await api.delete(`/api/grading/definitions/${id}`);
    if (result.ok) {
      success("Grader deleted");
      router.refresh();
    } else {
      error(result.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" /> Automated Graders
        </h3>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setOpen(true)}>
          <Plus size={14} className="mr-1" /> New Grader
        </Button>
      </div>

      <div className="space-y-2">
        {initialDefinitions.length === 0 ? (
          <p className="text-xs text-muted-foreground italic px-2">No custom graders configured.</p>
        ) : initialDefinitions.map((g) => (
          <div key={g.id} className="group flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2 text-sm transition-colors hover:border-primary/30">
            <div>
              <p className="font-medium">{g.name}</p>
              <p className="text-xs text-muted-foreground">{g.provider} / {g.modelName}</p>
            </div>
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0 text-danger" onClick={() => handleDelete(g.id)}>
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Automated Grader" description="LLM-based automated evaluation using rubrics and custom prompts." wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldWrapper label="Name" required>
            <Input required placeholder="Exact Match Rubric" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FieldWrapper>
          <FieldWrapper label="Description">
            <Input placeholder="Standard correctness evaluator for chat outputs." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </FieldWrapper>
          <div className="grid gap-4 md:grid-cols-2">
             <FieldWrapper label="Provider">
              <Select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
                <option value="groq">Groq</option>
                <option value="gemini">Gemini</option>
              </Select>
            </FieldWrapper>
            <FieldWrapper label="Model">
              <Input value={form.modelName} onChange={(e) => setForm({ ...form, modelName: e.target.value })} />
            </FieldWrapper>
          </div>
          <FieldWrapper label="Prompt Template" required>
            <Textarea 
              required 
              className="trace-font min-h-[150px]" 
              value={form.promptTemplate} 
              onChange={(e) => setForm({ ...form, promptTemplate: e.target.value })} 
            />
          </FieldWrapper>
          <ModalActions>
             <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
             <Button type="submit" loading={loading}><Plus size={14} className="mr-1" /> Create Grader</Button>
          </ModalActions>
        </form>
      </Modal>
    </div>
  );
}
