"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Menu, X, Search } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api-client";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/prompts", label: "Prompts" },
  { href: "/datasets", label: "Datasets" },
  { href: "/runs", label: "Runs" },
  { href: "/traces", label: "Traces" },
  { href: "/grading", label: "Grading" },
  { href: "/comparisons", label: "Comparisons" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
];

export function MobileMenuButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="focus-ring grid size-9 place-items-center rounded-md border border-border bg-card lg:hidden" aria-label="Open navigation" onClick={() => setOpen(true)}>
        <Menu size={17} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <nav className="absolute left-0 top-0 h-full w-72 border-r border-border bg-card p-5">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-semibold">AI QA Lab</span>
              <button className="focus-ring grid size-8 place-items-center rounded-md border border-border" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="space-y-1">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="focus-ring flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">{item.label}</Link>
              ))}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ prompts: any[]; datasets: any[]; runs: any[] }>({ prompts: [], datasets: [], runs: [] });

  const search = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) { setResults({ prompts: [], datasets: [], runs: [] }); return; }
    const r = await api.get<any>(`/api/search?q=${encodeURIComponent(q)}`);
    if (r.ok) setResults(r.data);
  }, []);

  return (
    <>
      <button className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground md:flex" onClick={() => setOpen(true)}>
        <Search size={16} /> Search runs, traces, prompts
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="mx-auto mt-20 max-w-lg rounded-lg border border-border bg-card p-4 shadow-panel relative">
            <input autoFocus className="focus-ring w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="Search prompts, datasets, runs..." value={query} onChange={(e) => search(e.target.value)} />
            {query.length >= 2 && (
              <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
                {results.prompts?.map((p: any) => (
                  <Link key={p.id} href="/prompts" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm hover:bg-muted">Prompt: {p.title ?? p.promptKey}</Link>
                ))}
                {results.datasets?.map((d: any) => (
                  <Link key={d.id} href="/datasets" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm hover:bg-muted">Dataset: {d.name}</Link>
                ))}
                {results.runs?.map((r: any) => (
                  <Link key={r.id} href="/runs" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm hover:bg-muted">Run: {r.modelName}</Link>
                ))}
                {results.prompts?.length === 0 && results.datasets?.length === 0 && results.runs?.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No results found</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
