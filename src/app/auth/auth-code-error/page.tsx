import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-panel">
        <h1 className="text-2xl font-semibold">Authentication failed</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The sign-in link expired or the OAuth provider rejected the request. Start a fresh sign-in flow.
        </p>
        <Link className="focus-ring mt-6 inline-flex rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground" href="/sign-in">
          Back to Sign In
        </Link>
      </section>
    </main>
  );
}
