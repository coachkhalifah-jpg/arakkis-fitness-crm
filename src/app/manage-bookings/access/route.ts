import { NextRequest } from "next/server";
import { redirectToAppPath } from "@/lib/http/app-redirect";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || !/^[A-Za-z0-9_-]{40,80}$/.test(token)) {
    return redirectToAppPath("/manage-bookings");
  }
  // Legacy links must not turn a confirmation bearer into remembered-device
  // access. Scoped booking links now carry their token directly to the detail
  // route, while this compatibility route only returns a truthful recovery
  // state.
  return redirectToAppPath("/manage-bookings");
}
