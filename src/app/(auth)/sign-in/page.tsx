import { ShieldCheck } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { signIn, signInWithMagicLink, signInWithOAuth } from "@/app/(auth)/auth-actions";

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-panel">
        <div className="mb-6 grid size-12 place-items-center rounded-lg bg-primary/15 text-primary">
          <ShieldCheck size={24} aria-hidden="true" />
        </div>
        <PageTitle
          title="Sign in"
          description="Access your AI evaluation workspace with password, magic link, Google, or GitHub."
        />
        {params.error ? (
          <div className="mb-4 rounded-md border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger">
            {params.error}
          </div>
        ) : null}
        {params.sent ? (
          <div className="mb-4 rounded-md border border-success/35 bg-success/10 px-3 py-2 text-sm text-success">
            Magic link sent. Check your inbox.
          </div>
        ) : null}
        <form action={signIn} className="space-y-4">
          <label className="block text-sm font-medium">
            Email
            <input name="email" className="focus-ring mt-2 w-full rounded-md border border-border bg-card px-3 py-2" type="email" required />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input name="password" className="focus-ring mt-2 w-full rounded-md border border-border bg-card px-3 py-2" type="password" required />
          </label>
          <button className="focus-ring w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
            Continue
          </button>
        </form>
        <form action={signInWithMagicLink} className="mt-3 flex gap-2">
          <input name="email" className="focus-ring min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm" type="email" placeholder="Email for magic link" required />
          <button className="focus-ring rounded-md border border-border px-3 py-2 text-sm">Send Link</button>
        </form>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <form action={signInWithOAuth}>
            <input type="hidden" name="provider" value="google" />
            <button className="focus-ring w-full rounded-md border border-border px-3 py-2 text-sm">Google</button>
          </form>
          <form action={signInWithOAuth}>
            <input type="hidden" name="provider" value="github" />
            <button className="focus-ring w-full rounded-md border border-border px-3 py-2 text-sm">GitHub</button>
          </form>
        </div>
      </section>
    </main>
  );
}
