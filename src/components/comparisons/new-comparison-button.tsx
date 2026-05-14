"use client";

import { useState } from "react";
import { GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateComparisonModal } from "@/components/comparisons/comparison-actions";
import type { EvalRun } from "@/lib/types";

export function NewComparisonButton({ runs }: { runs: EvalRun[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <GitCompare size={16} /> New Comparison
      </Button>
      <CreateComparisonModal open={open} onClose={() => setOpen(false)} runs={runs} />
    </>
  );
}
