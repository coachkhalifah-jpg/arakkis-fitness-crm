import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { safeAdminRedirect } from "@/lib/auth/redirects";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeAdminRedirect(request.nextUrl.searchParams.get("next"));
  if (!code) {
    return NextResponse.redirect(new URL("/admin/sign-in?reset=invalid", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/admin/sign-in?reset=invalid", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
