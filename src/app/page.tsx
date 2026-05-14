import { ArrowRight, GitCompare, PlayCircle, ShieldCheck, TerminalSquare } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck size={18} aria-hidden="true" />
            </span>
            AI QA Lab
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link className="focus-ring rounded-md border border-border px-3 py-2" href="/sign-in">
              Sign in
            </Link>
            <Link className="focus-ring rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground" href="/sign-up">
              Get Started
            </Link>
          </nav>
        </div>
      </header>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:py-20">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-primary">Prompt and agent release gates</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-normal md:text-6xl">
            AI QA / Evaluation Lab
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Version prompts, run datasets through Gemini and Groq, capture traces, grade outputs, compare candidates, and block releases when quality thresholds fail.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="focus-ring inline-flex items-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground" href="/sign-up">
              Get Started
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className="focus-ring inline-flex items-center gap-2 rounded-md border border-border px-4 py-3 text-sm" href="/dashboard">
              Open Workspace
            </Link>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-panel">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: "Prompt Registry", icon: TerminalSquare, value: "Immutable versions" },
              { label: "Run Executor", icon: PlayCircle, value: "Queued evals" },
              { label: "Release Gates", icon: GitCompare, value: "Pass/fail evidence" }
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border bg-muted/30 p-4">
                <item.icon className="text-primary" size={20} aria-hidden="true" />
                <h2 className="mt-4 text-sm font-semibold">{item.label}</h2>
                <p className="mt-2 text-xs text-muted-foreground">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="trace-font mt-4 rounded-lg border border-border bg-background p-4 text-xs leading-6 text-muted-foreground">
            run_1042 / support_triage_v7 / groq / score 0.91 / gate pass
          </div>
        </div>
      </section>
    </main>
  );
}
