"use client";

import { useState } from "react";
import { ChevronDown, Check, Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WorkspaceSwitcher({ currentWorkspace, workspaces }: { currentWorkspace: string, workspaces: { id: string, name: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setOpen(!open)}
        className="focus-ring inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted transition-colors"
      >
        <Building2 size={16} className="text-muted-foreground" />
        {currentWorkspace}
        <ChevronDown size={14} className="ml-1 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-40 w-56 rounded-lg border border-border bg-card p-1 shadow-xl animate-in fade-in slide-in-from-top-2">
            <p className="px-3 py-2 text-xs font-bold text-muted-foreground uppercase">Workspaces</p>
            {workspaces.map((ws) => (
              <button 
                key={ws.id}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted"
                onClick={() => { /* Handle workspace change - usually via cookie or session */ setOpen(false); }}
              >
                {ws.name}
                {ws.name === currentWorkspace && <Check size={14} className="text-primary" />}
              </button>
            ))}
            <div className="my-1 border-t border-border" />
            <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-primary hover:bg-primary/5">
              <Plus size={14} /> Create Workspace
            </button>
          </div>
        </>
      )}
    </div>
  );
}
