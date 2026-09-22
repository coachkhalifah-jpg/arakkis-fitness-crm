import { NextResponse, type NextRequest } from "next/server";

export type SessionCookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

/**
 * Cookie attributes shared by the browser client, server client, and proxy.
 * `secure` follows the public app URL so production HTTPS (Render) persists
 * the session, while local http://localhost does not mark cookies Secure.
 * Do not set `name` here; Next's cookie store treats a leaked name as a second cookie.
 */
export function supabaseAuthCookieOptions(appUrl: string): {
  path: "/";
  sameSite: "lax";
  secure: boolean;
} {
  let secure = false;
  try {
    secure = new URL(appUrl).protocol === "https:";
  } catch {
    secure = false;
  }
  return { path: "/", sameSite: "lax", secure };
}

/** Headers @supabase/ssr >= 0.10 passes to setAll. 0.7 does not, so callers fall back. */
export const SESSION_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
} as const;

/** True when the jar contains a non-empty Supabase SSR auth-token cookie chunk. */
export function hasSupabaseAuthTokenCookie(
  cookies: Iterable<{ name: string; value: string }>,
): boolean {
  for (const cookie of cookies) {
    if (
      cookie.name.startsWith("sb-") &&
      cookie.name.includes("-auth-token") &&
      cookie.value.length > 0
    ) {
      return true;
    }
  }
  return false;
}

/** Copy Supabase SSR cookie writes onto a redirect/response without dropping options. */
export function applySessionCookies(
  response: NextResponse,
  cookiesToSet: readonly SessionCookieToSet[],
) {
  for (const { name, value, options } of cookiesToSet) {
    response.cookies.set(name, value, options);
  }
}

/**
 * Apply the cache headers from `setAll`'s second argument. When the installed
 * `@supabase/ssr` does not supply them, use the documented no-store set so a
 * refreshed session cannot be cached and replayed.
 */
export function applySessionCacheHeaders(
  response: NextResponse,
  headers?: Record<string, string> | null,
) {
  const provided = headers && Object.values(headers).some((value) => value.length > 0);
  const source = provided ? headers : SESSION_CACHE_HEADERS;
  for (const [key, value] of Object.entries(source)) {
    if (value) response.headers.set(key, value);
  }
}

/**
 * Official proxy `setAll` write: update the request the rest of the render sees,
 * then attach the same cookies and cache headers to a new response.
 * Returning any earlier response drops the refreshed session.
 */
export function writeRefreshedSession(
  request: NextRequest,
  cookiesToSet: readonly SessionCookieToSet[],
  headers?: Record<string, string> | null,
) {
  cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
  const response = NextResponse.next({ request });
  applySessionCookies(response, cookiesToSet);
  applySessionCacheHeaders(response, headers);
  return response;
}

/** Redirects must carry the cookies and cache headers from the session response. */
export function redirectWithSession(
  url: URL,
  cookiesToSet: readonly SessionCookieToSet[],
  source?: NextResponse,
) {
  const redirectResponse = NextResponse.redirect(url);
  applySessionCookies(redirectResponse, cookiesToSet);
  applySessionCacheHeaders(redirectResponse, {
    "cache-control": source?.headers.get("cache-control") ?? "",
    expires: source?.headers.get("expires") ?? "",
    pragma: source?.headers.get("pragma") ?? "",
  });
  return redirectResponse;
}

export function publicAppOrigin(env: {
  APP_BASE_URL?: string;
  NEXT_PUBLIC_APP_URL: string;
}): string {
  return env.APP_BASE_URL || env.NEXT_PUBLIC_APP_URL;
}

export function passwordResetRedirectTo(baseUrl: string, nextPath: string) {
  return new URL(`/auth/callback?next=${nextPath}`, baseUrl).toString();
}
