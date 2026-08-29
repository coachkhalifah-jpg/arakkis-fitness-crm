"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/db/server";
import { safeAdminRedirect } from "@/lib/auth/redirects";
import { getPublicEnv } from "@/lib/config/env";

export type AuthActionState = { error?: string; success?: string };
const GENERIC_AUTH_ERROR = "Sign-in failed. Check your email and password and try again.";
const GENERIC_RESET_MESSAGE =
  "If an account exists for that email, a password reset link has been sent.";

export async function signIn(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeAdminRedirect(formData.get("next"));
  if (!email || !password) return { error: GENERIC_AUTH_ERROR };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: GENERIC_AUTH_ERROR };
  redirect(next);
}

export async function requestPasswordReset(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return { error: "Enter your email address." };

  const env = getPublicEnv();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: new URL(
      "/auth/callback?next=/admin/reset-password",
      env.NEXT_PUBLIC_APP_URL,
    ).toString(),
  });

  return { success: GENERIC_RESET_MESSAGE };
}

export async function updatePassword(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirmation) return { error: "Passwords do not match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Unable to update the password. Request a new reset link." };
  redirect("/admin/sign-in?reset=complete");
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error && error.name !== "AuthSessionMissingError") throw error;

  // Remove every locally persisted auth-token chunk as well so Back/refresh
  // cannot reuse stale authentication state.
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) {
      cookieStore.delete(cookie.name);
    }
  }
  redirect("/");
}
