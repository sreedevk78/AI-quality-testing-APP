"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Check, Building2, Plus } from "lucide-react";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

export function WorkspaceSwitcher({
  currentWorkspace,
  currentWorkspaceId,
  workspaces
}: {
  currentWorkspace: string;
  currentWorkspaceId: string;
  workspaces: { id: string; name: string }[];
}) {
  const { error } = useToast();
  const [open, setOpen] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  async function switchWorkspace(workspaceId: string) {
    if (workspaceId === currentWorkspaceId) {
      setOpen(false);
      return;
    }

    setSwitchingTo(workspaceId);
    const result = await api.post("/api/workspaces/switch", { workspaceId });
    setSwitchingTo(null);
    if (result.ok) {
      setOpen(false);
      // Hard redirect to clear all client caches and ensure isolation
      window.location.href = "/dashboard";
    } else {
      error(result.error);
    }
  }

  return (
    <div className="relative">
      <button 
        type="button"
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
                type="button"
                key={ws.id}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                disabled={Boolean(switchingTo)}
                onClick={() => switchWorkspace(ws.id)}
              >
                {ws.name}
                {switchingTo === ws.id ? (
                  <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : ws.id === currentWorkspaceId || ws.name === currentWorkspace ? (
                  <Check size={14} className="text-primary" />
                ) : null}
              </button>
            ))}
            <div className="my-1 border-t border-border" />
            <Link href="/onboarding" onClick={() => setOpen(false)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-primary hover:bg-primary/5">
              <Plus size={14} /> Create Workspace
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
