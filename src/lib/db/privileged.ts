import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/config/env";

/** Use only from trusted server-side workflows. Never import this module into client code. */
export function createPrivilegedClient() {
  const env = getServerEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
