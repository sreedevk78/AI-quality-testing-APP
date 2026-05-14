"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

export function AutoGradeButton({ runId }: { runId?: string }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleAutoGrade() {
    if (!runId) { error("No run selected for auto-grading"); return; }
    setLoading(true);
    const result = await api.post("/api/grading/auto-grade", { runId });
    setLoading(false);
    if (result.ok) { success("Auto-grading complete"); router.refresh(); }
    else error(result.error);
  }

  return (
    <Button variant="secondary" onClick={handleAutoGrade} loading={loading}>
      <Bot size={16} /> Auto-Grade
    </Button>
  );
}
