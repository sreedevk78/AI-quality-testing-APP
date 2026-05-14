"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitCompare, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Modal, ModalActions } from "@/components/ui/modal";
import { FieldWrapper, Input, Select } from "@/components/ui/form-field";
import type { EvalRun } from "@/lib/types";

type CreateComparisonProps = {
  open: boolean;
  onClose: () => void;
  runs: EvalRun[];
};

export function CreateComparisonModal({ open, onClose, runs }: CreateComparisonProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const completed = runs.filter((r) => r.status === "completed");
  const [baselineId, setBaselineId] = useState(completed[0]?.id ?? "");
  const [candidateId, setCandidateId] = useState(completed[1]?.id ?? "");
  const [threshold, setThreshold] = useState(0.85);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!baselineId || !candidateId) { error("Select both runs"); return; }
    if (baselineId === candidateId) { error("Must be different runs"); return; }
    setLoading(true);
    const result = await api.post("/api/comparisons", { baselineRunId: baselineId, candidateRunId: candidateId, threshold });
    setLoading(false);
    if (result.ok) { success("Comparison created"); onClose(); router.refresh(); }
    else error(result.error);
  }

  return (
    <Modal open={open} onClose={onClose} title="Create comparison" description="Compare baseline vs candidate runs.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FieldWrapper label="Baseline run" required>
          <Select value={baselineId} onChange={(e) => setBaselineId(e.target.value)}>
            {completed.map((r) => <option key={r.id} value={r.id}>{r.name} ({Math.round(r.averageScore * 100)}%)</option>)}
          </Select>
        </FieldWrapper>
        <FieldWrapper label="Candidate run" required>
          <Select value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
            {completed.map((r) => <option key={r.id} value={r.id}>{r.name} ({Math.round(r.averageScore * 100)}%)</option>)}
          </Select>
        </FieldWrapper>
        <FieldWrapper label="Threshold">
          <Input type="number" step="0.01" min="0" max="1" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
        </FieldWrapper>
        <ModalActions>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}><GitCompare size={16} /> Compare</Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

export function ApproveReleaseButton({ promptVersionId, runId, reportId }: { promptVersionId: string; runId?: string; reportId: string }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);

  async function approve() {
    setLoading(true);
    const result = await api.post("/api/releases/approve", { promptVersionId, runId, comparisonReportId: reportId, notes: "UI approval" });
    setLoading(false);
    if (result.ok) { success("Release approved"); router.refresh(); }
    else error(result.error);
  }

  return (
    <Button onClick={approve} loading={loading}><ShieldCheck size={16} /> Approve Release</Button>
  );
}
