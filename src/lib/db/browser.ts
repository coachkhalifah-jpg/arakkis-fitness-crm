import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAuthCookieOptions } from "@/lib/auth/session-cookies";
import { getPublicEnv } from "@/lib/config/env";

export function createClient(): SupabaseClient {
  const env = getPublicEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookieOptions: supabaseAuthCookieOptions(env.NEXT_PUBLIC_APP_URL),
  });
}
