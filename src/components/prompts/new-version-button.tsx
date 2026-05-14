"use client";

import { useState } from "react";
import { CopyPlus } from "lucide-react";
import { CreatePromptModal } from "@/components/prompts/prompt-actions";
import { Button } from "@/components/ui/button";

export function NewVersionButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CopyPlus size={16} /> New Version
      </Button>
      <CreatePromptModal open={open} onClose={() => setOpen(false)} projectId={projectId} />
    </>
  );
}
