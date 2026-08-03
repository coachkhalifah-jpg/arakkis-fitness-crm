import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { rememberedDeviceCookie } from "@/lib/registration/device";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || !/^[A-Za-z0-9_-]{40,80}$/.test(token)) {
    return NextResponse.redirect(new URL("/manage-bookings", request.url));
  }
  const response = NextResponse.redirect(new URL("/manage-bookings", request.url));
  response.cookies.set(rememberedDeviceCookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return response;
}
