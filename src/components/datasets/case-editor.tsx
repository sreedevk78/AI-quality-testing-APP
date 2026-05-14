"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Save, X, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/form-field";

export function InlineCaseEditor({ item }: { item: any }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    inputPayload: item.input,
    expectedOutput: item.expected,
    difficulty: item.difficulty,
    tags: item.tags.join(", "),
  });

  async function handleSave() {
    setLoading(true);
    try {
      const result = await api.patch(`/api/dataset-cases/${item.id}`, {
        inputPayloadJson: JSON.parse(form.inputPayload),
        expectedOutputJson: JSON.parse(form.expectedOutput),
        difficulty: form.difficulty,
        tags: form.tags.split(",").map((t: string) => t.trim()).filter(Boolean),
      });
      setLoading(false);
      if (result.ok) {
        success("Case updated");
        setEditing(false);
        router.refresh();
      } else {
        error(result.error);
      }
    } catch {
      setLoading(false);
      error("Invalid JSON in payload or expected output");
    }
  }

  if (editing) {
    return (
      <tr className="bg-primary/5">
        <td className="py-3 px-2">
           <Textarea className="text-xs h-20" value={form.inputPayload} onChange={(e) => setForm({ ...form, inputPayload: e.target.value })} />
        </td>
        <td className="py-3 px-2">
           <Textarea className="text-xs h-20" value={form.expectedOutput} onChange={(e) => setForm({ ...form, expectedOutput: e.target.value })} />
        </td>
        <td className="py-3 px-2">
           <Select className="text-xs" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
             <option value="easy">Easy</option>
             <option value="medium">Medium</option>
             <option value="hard">Hard</option>
           </Select>
        </td>
        <td className="py-3 px-2">
           <Input className="text-xs" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        </td>
        <td className="py-3 px-2">
           <div className="flex gap-1">
             <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleSave} loading={loading}><Save size={14} /></Button>
             <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditing(false)}><X size={14} /></Button>
           </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="group hover:bg-muted/30 transition-colors">
      <td className="py-3">
        <div className="font-medium truncate max-w-[150px]">{item.name}</div>
        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{item.input}</div>
      </td>
      <td className="max-w-md py-3 text-muted-foreground truncate">{item.expected}</td>
      <td className="py-3 capitalize">{item.difficulty}</td>
      <td className="py-3">{item.tags.join(", ")}</td>
      <td className="py-3">
         <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
           <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditing(true)}><Edit2 size={14} /></Button>
         </div>
      </td>
    </tr>
  );
}

export function DatasetSnapshotButton({ datasetId }: { datasetId: string }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSnapshot() {
    setLoading(true);
    const result = await api.post(`/api/datasets/${datasetId}/snapshot`);
    setLoading(false);
    if (result.ok) {
      success("New version snapshot created");
      router.refresh();
    } else {
      error(result.error);
    }
  }

  return (
    <Button variant="secondary" onClick={handleSnapshot} loading={loading} className="text-xs h-8 px-3">
      Snapshot Version
    </Button>
  );
}
