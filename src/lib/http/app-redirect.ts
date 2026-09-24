import { NextResponse } from "next/server";
import { publicAppOrigin } from "@/lib/auth/session-cookies";
import { getServerEnv } from "@/lib/config/env";

/**
 * Absolute app path against the configured public origin.
 * Do not use request.url — behind Render/proxies that can be an internal
 * host such as https://localhost:10000.
 */
export function appPathUrl(
  path: string,
  env: { APP_BASE_URL?: string; NEXT_PUBLIC_APP_URL: string },
) {
  const origin = publicAppOrigin(env).replace(/\/+$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, `${origin}/`).toString();
}

export function redirectToAppPath(path: string) {
  return NextResponse.redirect(appPathUrl(path, getServerEnv()));
}
