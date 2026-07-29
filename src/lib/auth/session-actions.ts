"use server";

import { redirect } from "next/navigation";
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
  await supabase.auth.signOut();
  redirect("/");
}
