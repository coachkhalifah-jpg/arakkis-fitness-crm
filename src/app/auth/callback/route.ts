import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { safeRecoveryRedirect } from "@/lib/auth/redirects";
import { getServerEnv } from "@/lib/config/env";

function hostedRedirect(path: string) {
  const env = getServerEnv();
  return new URL(path, env.APP_BASE_URL || env.NEXT_PUBLIC_APP_URL);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeRecoveryRedirect(request.nextUrl.searchParams.get("next"));
  if (!code) {
    return NextResponse.redirect(hostedRedirect("/admin/update-password?error=invalid"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(hostedRedirect("/admin/update-password?error=invalid"));
  }

  return NextResponse.redirect(hostedRedirect(next));
}
