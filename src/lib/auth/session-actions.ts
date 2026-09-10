"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/db/server";
import { safeAdminRedirect } from "@/lib/auth/redirects";

export type AuthActionState = { error?: string; success?: string };
const GENERIC_AUTH_ERROR = "Sign-in failed. Check your email and password and try again.";

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
