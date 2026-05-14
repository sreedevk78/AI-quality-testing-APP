import {
  Activity,
  BarChart3,
  Blocks,
  ClipboardCheck,
  Database,
  GitCompare,
  Home,
  PlayCircle,
  Settings,
  ShieldCheck,
  LogOut,
  UserCircle,
  Sparkles,
  TerminalSquare
} from "lucide-react";
import { MobileMenuButton, GlobalSearch } from "@/components/shell/client-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/(auth)/auth-actions";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/prompts", label: "Prompts", icon: TerminalSquare },
  { href: "/datasets", label: "Datasets", icon: Database },
  { href: "/runs", label: "Runs", icon: PlayCircle },
  { href: "/traces", label: "Traces", icon: Activity },
  { href: "/grading", label: "Grading", icon: ClipboardCheck },
  { href: "/comparisons", label: "Comparisons", icon: GitCompare },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings }
];

async function resolveShellIdentity(workspaceName?: string, userEmail?: string) {
  if (workspaceName && userEmail) {
    return { workspaceName, userEmail };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

    if (!user) {
      return {
        workspaceName: workspaceName ?? "Workspace",
        userEmail: userEmail ?? "Signed out"
      };
    }

    const profile = await prisma.user.findUnique({
      where: { authUserId: user.id },
      include: {
        memberships: {
          include: { workspace: true },
          orderBy: { createdAt: "asc" },
          take: 1
        }
      }
    });

    return {
      workspaceName: workspaceName ?? profile?.memberships[0]?.workspace.name ?? "Workspace",
      userEmail: userEmail ?? profile?.email ?? user.email ?? "Signed in"
    };
  } catch {
    return {
      workspaceName: workspaceName ?? "Workspace",
      userEmail: userEmail ?? "Signed in"
    };
  }
}

export async function AppShell({
  children,
  workspaceName,
  userEmail
}: {
  children: ReactNode;
  workspaceName?: string;
  userEmail?: string;
}) {
  const identity = await resolveShellIdentity(workspaceName, userEmail);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden border-r border-border bg-card/80 px-4 py-5 backdrop-blur lg:block">
        <Link href="/" className="flex items-center gap-3 px-2">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck size={18} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold">AI QA Lab</span>
            <span className="block text-xs text-muted-foreground">Evaluation workspace</span>
          </span>
        </Link>
        <nav aria-label="Primary" className="mt-8 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="focus-ring flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <item.icon size={17} aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 rounded-lg border border-border bg-muted/45 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Blocks size={16} className="text-primary" aria-hidden="true" />
            Gemini + Groq
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Provider adapters normalize outputs, usage, latency, retries, and structured JSON.
          </p>
        </div>
      </aside>
      <main>
        <header className="sticky top-0 z-20 border-b border-border bg-background/88 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-8">
            <MobileMenuButton />
            <Link href="/dashboard" className="font-semibold lg:hidden">
              AI QA Lab
            </Link>
            <GlobalSearch />
            <div className="ml-auto flex items-center gap-2">
              <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
                {identity.workspaceName}
              </button>
              <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground md:flex">
                <UserCircle size={16} aria-hidden="true" />
                {identity.userEmail}
              </div>
              <Link
                href="/runs"
                className="focus-ring inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                <Sparkles size={16} aria-hidden="true" />
                New Run
              </Link>
              <form action={signOut}>
                <button className="focus-ring grid size-9 place-items-center rounded-md border border-border bg-card" aria-label="Sign out">
                  <LogOut size={16} aria-hidden="true" />
                </button>
              </form>
            </div>
          </div>
        </header>
        <div className="px-4 py-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
