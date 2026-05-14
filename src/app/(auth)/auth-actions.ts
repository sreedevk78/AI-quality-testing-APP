"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WorkspaceService } from "@/server/services/workspace-service";
import { syncAuthUserProfile, type RequestContext } from "@/server/context";

export async function signIn(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function signInWithMagicLink(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const email = String(formData.get("email") ?? "");
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/dashboard` }
  });

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/sign-in?sent=magic-link");
}

export async function signInWithOAuth(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const provider = String(formData.get("provider") ?? "");
  if (provider !== "google" && provider !== "github") {
    redirect("/sign-in?error=Unsupported%20OAuth%20provider");
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/callback?next=/dashboard` }
  });

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  if (data.url) {
    redirect(data.url);
  }

  redirect("/sign-in");
}

export async function signUp(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/onboarding` }
  });

  if (error) {
    redirect(`/sign-up?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/onboarding");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/");
}

export async function createWorkspace(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
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
