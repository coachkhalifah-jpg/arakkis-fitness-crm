import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/config/env";
import { applySessionCookies, type SessionCookieToSet } from "@/lib/auth/session-cookies";

/**
 * Session refresh + optimistic /admin gate.
 * Kept as `middleware.ts` because Next.js 16.3.4 Turbopack registers that convention;
 * standalone `proxy.ts` alone does not emit a middleware manifest in this toolchain.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pendingCookies: SessionCookieToSet[] = [];
  const env = getPublicEnv();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          applySessionCookies(response, cookiesToSet);
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isPublicAdminRoute =
    pathname === "/admin/sign-in" ||
    pathname === "/admin/reset-password" ||
    pathname === "/admin/update-password" ||
    pathname === "/admin/access-denied" ||
    pathname === "/admin/invitations/accept";

  if (pathname.startsWith("/admin") && !isPublicAdminRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/sign-in";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    const redirectResponse = NextResponse.redirect(url);
    // Preserve cookie clears/refreshes from getUser(); do not discard them on redirect.
    applySessionCookies(redirectResponse, pendingCookies);
    return redirectResponse;
  }

  return response;
}

export const config = { matcher: ["/admin/:path*"] };
