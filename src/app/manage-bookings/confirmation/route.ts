import { NextRequest, NextResponse } from "next/server";
import { getConfirmationToken } from "@/lib/registration/booking-management";

export async function GET(request: NextRequest) {
  const registrationId = request.nextUrl.searchParams.get("registrationId")?.trim();
  if (!registrationId) {
    return NextResponse.redirect(new URL("/manage-bookings", request.url));
  }
  const token = await getConfirmationToken(registrationId);
  if (!token) {
    return NextResponse.redirect(new URL(`/manage-bookings/${registrationId}`, request.url));
  }
  return NextResponse.redirect(
    new URL(`/registration/confirmation?token=${encodeURIComponent(token)}`, request.url),
  );
}
