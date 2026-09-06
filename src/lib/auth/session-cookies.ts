import type { NextResponse } from "next/server";

export type SessionCookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

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

export function publicAppOrigin(env: {
  APP_BASE_URL?: string;
  NEXT_PUBLIC_APP_URL: string;
}): string {
  return env.APP_BASE_URL || env.NEXT_PUBLIC_APP_URL;
}

export function passwordResetRedirectTo(baseUrl: string, nextPath: string) {
  return new URL(`/auth/callback?next=${nextPath}`, baseUrl).toString();
}
