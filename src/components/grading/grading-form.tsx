"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-field";
import { ClipboardCheck } from "lucide-react";

type GradingFormProps = {
  runItemId: string;
  caseName: string;
  input?: string;
  output?: string;
  expected?: string;
  nextItemId?: string;
  onSuccess?: () => void;
};

export function GradingForm({ runItemId, input, output, expected, nextItemId, onSuccess }: GradingFormProps) {
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
    try {
      const result = await api.post("/api/grading/reviews", {
        runItemId,
        verdict,
        score: avgScore,
        notes: notes || undefined,
      });
      
      if (result.ok) {
        success(`Review submitted: ${verdict}`);
        if (onSuccess) {
          onSuccess();
        } else if (nextItemId) {
          router.push(`/grading?item=${nextItemId}`);
        } else {
          router.push("/grading");
        }
        
        // Trigger refresh in the background without blocking the UI
        setTimeout(() => {
          router.refresh();
        }, 100);
      } else {
        error(result.error);
      }
    } catch (err) {
      error("An unexpected error occurred while submitting the review.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="grid size-12 place-items-center rounded-lg bg-primary/15 text-primary">
          <ClipboardCheck size={22} aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Review Submission</h3>
          <p className="text-xs text-muted-foreground">Adjust scores based on output quality.</p>
        </div>
      </div>

      <div className="space-y-3 py-4">
        <div className="rounded-lg border border-border bg-muted/35 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">Input</p>
          <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">{input}</pre>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-[10px] font-bold uppercase text-primary">AI Response</p>
          <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-primary">{output}</pre>
        </div>
        <div className="rounded-lg border border-border bg-muted/35 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">Expected</p>
          <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">{expected}</pre>
        </div>
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
