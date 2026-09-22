import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/db/update-session";

/**
 * Next.js 16 auth proxy. It must sit next to `src/app` and be the only proxy
 * file. A root `middleware.ts` is the deprecated Edge convention; Next.js 16.2
 * refuses to build when both exist, and that Edge path does not reliably send
 * Supabase Set-Cookie headers from `next start` on Render.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
