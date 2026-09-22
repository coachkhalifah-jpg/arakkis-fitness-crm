import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/config/env";
import {
  redirectWithSession,
  supabaseAuthCookieOptions,
  writeRefreshedSession,
  type SessionCookieToSet,
} from "@/lib/auth/session-cookies";

const PUBLIC_ADMIN_ROUTES = new Set([
  "/admin/sign-in",
  "/admin/reset-password",
  "/admin/update-password",
  "/admin/access-denied",
  "/admin/invitations/accept",
]);

/**
 * Refresh the Supabase auth cookies and apply the optimistic /admin gate.
 * `getClaims()` is the documented proxy check: it verifies the JWT and refreshes
 * the session before Server Components call `getUser()` with the same token.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const pendingCookies: SessionCookieToSet[] = [];
  const env = getPublicEnv();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: supabaseAuthCookieOptions(env.NEXT_PUBLIC_APP_URL),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          pendingCookies.push(...cookiesToSet);
          supabaseResponse = writeRefreshedSession(request, cookiesToSet, headers);
        },
      },
    },
  );

  // Nothing may run between creating the client and getClaims().
  const { data } = await supabase.auth.getClaims();
  const pathname = request.nextUrl.pathname;
  const isPublicAdminRoute = PUBLIC_ADMIN_ROUTES.has(pathname);

  if (pathname.startsWith("/admin") && !isPublicAdminRoute && !data?.claims) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/sign-in";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return redirectWithSession(url, pendingCookies, supabaseResponse);
  }

  return supabaseResponse;
}
