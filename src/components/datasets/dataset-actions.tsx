"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload } from "lucide-react";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Modal, ModalActions } from "@/components/ui/modal";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/form-field";

export function CreateDatasetModal({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId?: string }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await api.post("/api/datasets", {
      name,
      description: description || undefined,
      tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      projectId,
    });
    setLoading(false);
    if (result.ok) { success("Dataset created"); onClose(); router.refresh(); }
    else error(result.error);
  }

  return (
    <Modal open={open} onClose={onClose} title="Create dataset" description="Named test suite for evaluation runs.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FieldWrapper label="Name" required>
          <Input required placeholder="Support routing regression" value={name} onChange={(e) => setName(e.target.value)} />
        </FieldWrapper>
        <FieldWrapper label="Description">
          <Textarea placeholder="Golden test suite for routing evaluation." value={description} onChange={(e) => setDescription(e.target.value)} />
        </FieldWrapper>
        <FieldWrapper label="Tags (comma-separated)">
          <Input placeholder="routing, golden" value={tags} onChange={(e) => setTags(e.target.value)} />
        </FieldWrapper>
        <ModalActions>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}><Plus size={16} /> Create</Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

export function AddCaseModal({ open, onClose, datasetId }: { open: boolean; onClose: () => void; datasetId: string }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [inputPayload, setInputPayload] = useState('{ "message": "" }');
  const [expectedOutput, setExpectedOutput] = useState('{ "category": "" }');
  const [rubric, setRubric] = useState("{}");
  const [tags, setTags] = useState("");
  const [difficulty, setDifficulty] = useState("medium");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api.post(`/api/datasets/${datasetId}/cases`, {
        datasetId,
        inputPayload: JSON.parse(inputPayload),
        expectedOutput: JSON.parse(expectedOutput),
        rubric: JSON.parse(rubric),
        tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        difficulty,
      });
      setLoading(false);
      if (result.ok) { success("Test case added"); onClose(); router.refresh(); }
      else error(result.error);
    } catch {
      setLoading(false);
      error("Invalid JSON in one of the fields");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add test case" description="Input payload, expected output, rubric, and metadata." wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FieldWrapper label="Input Payload (JSON)" required>
          <Textarea required className="trace-font min-h-20" value={inputPayload} onChange={(e) => setInputPayload(e.target.value)} />
        </FieldWrapper>
        <FieldWrapper label="Expected Output (JSON)">
          <Textarea className="trace-font min-h-20" value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} />
        </FieldWrapper>
        <FieldWrapper label="Rubric (JSON)">
          <Textarea className="trace-font min-h-16" value={rubric} onChange={(e) => setRubric(e.target.value)} />
        </FieldWrapper>
        <div className="grid gap-4 md:grid-cols-2">
          <FieldWrapper label="Tags (comma-separated)">
            <Input placeholder="billing, escalation" value={tags} onChange={(e) => setTags(e.target.value)} />
          </FieldWrapper>
          <FieldWrapper label="Difficulty">
            <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          </FieldWrapper>
        </div>
        <ModalActions>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}><Plus size={16} /> Add Case</Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

export function ImportCsvModal({ open, onClose, datasetId }: { open: boolean; onClose: () => void; datasetId: string }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [csv, setCsv] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsv(await file.text());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!csv.trim()) { error("Upload or paste CSV data"); return; }
    setLoading(true);
    const result = await api.post("/api/datasets/import-csv", { datasetId, csv });
    setLoading(false);
    if (result.ok) {
      const data = result.data as { imported: number };
      success(`Imported ${data.imported} test cases`);
      onClose();
      router.refresh();
    } else {
      error(result.error);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import CSV" description="Map CSV columns to test case fields. Expects: input, expected, rubric, tags, difficulty." wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FieldWrapper label="Upload CSV file">
          <Input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
        </FieldWrapper>
        <FieldWrapper label="Or paste CSV content">
          <Textarea className="trace-font min-h-32" placeholder="input,expected,rubric,tags,difficulty" value={csv} onChange={(e) => setCsv(e.target.value)} />
        </FieldWrapper>
        <ModalActions>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}><Upload size={16} /> Import</Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
