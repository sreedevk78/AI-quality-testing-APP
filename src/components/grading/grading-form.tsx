"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { FieldWrapper, Textarea } from "@/components/ui/form-field";
import { ClipboardCheck } from "lucide-react";

type GradingFormProps = {
  runItemId: string;
  caseName: string;
};

export function GradingForm({ runItemId, caseName }: GradingFormProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState({
    correctness: 4,
    grounding: 4,
    tone: 4,
    schemaCompliance: 4,
  });
  const [notes, setNotes] = useState("");

  const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / (Object.keys(scores).length * 5);

  async function submit(verdict: string) {
    setLoading(true);
    const result = await api.post("/api/grading/reviews", {
      runItemId,
      verdict,
      score: avgScore,
      notes: notes || undefined,
    });
    setLoading(false);
    if (result.ok) {
      success(`Review submitted: ${verdict}`);
      router.refresh();
    } else {
      error(result.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid size-12 place-items-center rounded-lg bg-primary/15 text-primary">
        <ClipboardCheck size={22} aria-hidden="true" />
      </div>
      {Object.entries(scores).map(([key, value]) => {
        const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
        return (
          <label key={key} className="block text-sm">
            <span className="flex justify-between">
              <span>{label}</span>
              <span className="text-muted-foreground">{value}</span>
            </span>
            <input
              className="mt-2 w-full accent-primary"
              type="range"
              min="1"
              max="5"
              value={value}
              onChange={(e) => setScores((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
            />
          </label>
        );
      })}
      <Textarea
        placeholder="Reviewer notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => submit("needs_fix")} loading={loading}>
          Needs Fix
        </Button>
        <Button variant="primary" onClick={() => submit("approved")} loading={loading}>
          Approve
        </Button>
      </div>
    </div>
  );
}
