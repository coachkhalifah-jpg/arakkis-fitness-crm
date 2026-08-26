import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || !/^[A-Za-z0-9_-]{40,80}$/.test(token)) {
    return NextResponse.redirect(new URL("/manage-bookings", request.url));
  }
  // Legacy links must not turn a confirmation bearer into remembered-device
  // access. Scoped booking links now carry their token directly to the detail
  // route, while this compatibility route only returns a truthful recovery
  // state.
  return NextResponse.redirect(new URL("/manage-bookings", request.url));
}
