import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { safeRecoveryRedirect } from "@/lib/auth/redirects";
import { applySessionCookies, publicAppOrigin } from "@/lib/auth/session-cookies";
import { getPublicEnv, getServerEnv } from "@/lib/config/env";

/**
 * Password-recovery / auth code exchange.
 *
 * Session cookies must be written onto the redirect response itself. Writing only through
 * `cookies()` from `next/headers` and then returning a separate `NextResponse.redirect()`
 * can omit Set-Cookie on the response the browser actually receives.
 */
export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const publicEnv = getPublicEnv();
  const origin = publicAppOrigin(env);
  const code = request.nextUrl.searchParams.get("code");
  const next = safeRecoveryRedirect(request.nextUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/admin/update-password?error=invalid", origin));
  }

  const redirectResponse = NextResponse.redirect(new URL(next, origin));
  const cookieStore = await cookies();
  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
          applySessionCookies(redirectResponse, cookiesToSet);
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.info("[AUTH_DIAGNOSTIC]", {
      event: "auth_callback_exchange_failed",
      error_name: error.name,
      error_status: error.status ?? null,
      error_code: "code" in error ? ((error as { code?: string }).code ?? null) : null,
    });
    return NextResponse.redirect(new URL("/admin/update-password?error=invalid", origin));
  }

  return redirectResponse;
}
