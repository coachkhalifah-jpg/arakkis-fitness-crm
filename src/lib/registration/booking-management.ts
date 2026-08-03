import "server-only";

import { cookies } from "next/headers";
import { createPrivilegedClient } from "@/lib/db/privileged";
import { rememberedDeviceCookie } from "@/lib/registration/device";

export type ManagedBooking = {
  registration_id: string;
  event_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  venue_name: string;
  venue_street: string;
  venue_city: string;
  venue_state: string;
  venue_postal_code: string;
  host_organization_name: string;
  location_updated: boolean;
  registration_status: string;
  registration_outcome: string;
  series_slug: string | null;
};

async function token() {
  return (await cookies()).get(rememberedDeviceCookie)?.value ?? null;
}

export async function getManagedBookings() {
  const raw = await token();
  if (!raw) return null;
  const db = createPrivilegedClient();
  const { data, error } = await db.rpc("get_participant_upcoming_bookings", {
    p_token: raw,
  } as never);
  return error || !data ? null : (data as { participant_id: string; bookings: ManagedBooking[] });
}

export async function getBookingAlternatives(registrationId: string) {
  const raw = await token();
  if (!raw) return null;
  const db = createPrivilegedClient();
  const { data, error } = await db.rpc("get_participant_booking_alternatives", {
    p_token: raw,
    p_registration_id: registrationId,
  } as never);
  return error || !data ? null : (data as Array<Record<string, unknown>>);
}

export async function manageBooking(
  action: "CANCEL" | "RESTORE" | "TRANSFER",
  registrationId: string,
  targetEventId?: string,
) {
  const raw = await token();
  if (!raw)
    return {
      error: "Your booking access has expired. Save this device again from a confirmation page.",
    };
  const db = createPrivilegedClient();
  const { data, error } = await db.rpc("manage_participant_booking", {
    p_token: raw,
    p_action: action,
    p_registration_id: registrationId,
    p_target_event_id: targetEventId ?? null,
  } as never);
  if (error || !data) return { error: error?.message ?? "The booking could not be updated." };
  return data as Record<string, unknown>;
}
