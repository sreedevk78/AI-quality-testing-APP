"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { WorkspaceService } from "@/server/services/workspace-service";
import { syncAuthUserProfile, type RequestContext } from "@/server/context";
import { EventService } from "@/server/services/event-service";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function signIn(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect("/sign-in?error=Supabase%20is%20not%20configured");
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = sanitizeRedirectPath(String(formData.get("next") ?? "/dashboard"));
  const { error } = await safeAuthCall(() => supabase.auth.signInWithPassword({ email, password }));

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  await recordAuthAction(supabase, "auth_action", { method: "password", operation: "sign_in", email });
  redirect(next);
}

export async function signInWithMagicLink(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect("/sign-in?error=Supabase%20is%20not%20configured");
  }

  const email = String(formData.get("email") ?? "");
  const next = sanitizeRedirectPath(String(formData.get("next") ?? "/dashboard"));
  const origin = await getRequestOrigin();
  const { error } = await safeAuthCall(() => supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` }
  }));

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  await recordAuthAction(supabase, "auth_action", { method: "magic_link", operation: "requested", email });
  redirect("/sign-in?sent=magic-link");
}

export async function signInWithOAuth(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect("/sign-in?error=Supabase%20is%20not%20configured");
  }

  const provider = String(formData.get("provider") ?? "");
  if (provider !== "google" && provider !== "github") {
    redirect("/sign-in?error=Unsupported%20OAuth%20provider");
  }

  const next = sanitizeRedirectPath(String(formData.get("next") ?? "/dashboard"));
  const origin = await getRequestOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` }
  });

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  await recordAuthAction(supabase, "auth_action", { method: provider, operation: "oauth_redirect" });
  if (data.url) {
    redirect(data.url);
  }

  redirect("/sign-in");
}

export async function signUp(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect("/sign-up?error=Supabase%20is%20not%20configured");
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const origin = await getRequestOrigin();
  const { data, error } = await safeAuthCall(() => supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/onboarding` }
  }));

  if (error) {
    redirect(`/sign-up?error=${encodeURIComponent(error.message)}`);
  }

  await recordAuthAction(supabase, "auth_action", { method: "password", operation: "sign_up", email });
  if (!data?.session) {
    redirect("/sign-in?sent=confirm-email");
  }
  redirect("/onboarding");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await recordAuthAction(supabase, "auth_action", { operation: "sign_out" });
    await supabase.auth.signOut();
  }
  redirect("/");
}

export async function createWorkspace(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect("/sign-in?error=Supabase%20is%20not%20configured");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const profile = await syncAuthUserProfile(user);
  const context: RequestContext = {
    workspaceId: "",
    userId: profile.id,
    role: "owner",
    authUserId: user.id
  };
  const workspaces = new WorkspaceService();
  await workspaces.createForUser(context, {
    name: String(formData.get("name") ?? ""),
    role: String(formData.get("role") ?? ""),
    inviteEmail: String(formData.get("inviteEmail") ?? "") || undefined
  });
  redirect("/dashboard");
}

async function getRequestOrigin() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin) return origin;

  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (host) {
    const proto = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3001";
}

function sanitizeRedirectPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

async function safeAuthCall<T extends { error: { message: string } | null }>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : "Authentication request failed" }
    } as unknown as T;
  }
}

async function recordAuthAction(supabase: SupabaseClient, action: string, payload: Record<string, unknown>) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const profile = await syncAuthUserProfile(user);
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: profile.id },
      orderBy: { createdAt: "asc" }
    });
    if (!membership) return;
    await new EventService().emitRaw({
      workspaceId: membership.workspaceId,
      actorUserId: profile.id,
      entityType: "user",
      entityId: profile.id,
      action,
      payload
    });
  } catch {
    // Auth telemetry must not block account access.
  }
}
