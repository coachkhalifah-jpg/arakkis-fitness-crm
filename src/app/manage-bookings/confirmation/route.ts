import { NextRequest } from "next/server";
import { redirectToAppPath } from "@/lib/http/app-redirect";
import { getConfirmationToken } from "@/lib/registration/booking-management";

export async function GET(request: NextRequest) {
  const registrationId = request.nextUrl.searchParams.get("registrationId")?.trim();
  if (!registrationId) {
    return redirectToAppPath("/manage-bookings");
  }
  const token = await getConfirmationToken(registrationId);
  if (!token) {
    return redirectToAppPath(`/manage-bookings/${encodeURIComponent(registrationId)}`);
  }
  return redirectToAppPath(`/registration/confirmation?token=${encodeURIComponent(token)}`);
}
