import "server-only";

import { cookies } from "next/headers";
import { createPrivilegedClient } from "@/lib/db/privileged";
import { rememberedDeviceCookie } from "@/lib/registration/device";

export type ManagedBooking = {
  registration_id: string;
  event_id: string;
  name: string;
  description?: string | null;
  participant_instructions?: string | null;
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
  communication_url?: string | null;
  communication_label?: string | null;
};

export type BookingActionError = {
  error: string;
};

export function mapBookingError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("access is invalid") || normalized.includes("token"))
    return "Your booking access has expired or is no longer valid. Save this device again from a confirmation page.";
  if (normalized.includes("not found"))
    return "This booking is no longer available from this device.";
  if (normalized.includes("not active"))
    return "This booking has already been cancelled or changed.";
  if (normalized.includes("can no longer be cancelled"))
    return "This booking can no longer be cancelled.";
  if (normalized.includes("no longer bookable") || normalized.includes("unavailable"))
    return "This booking is no longer available to restore.";
  if (normalized.includes("full"))
    return "This class is now full, so the booking cannot be restored.";
  if (normalized.includes("already exists"))
    return "You already have an active booking for this class.";
  return "We couldn't update this booking. Please refresh and try again.";
}

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

export async function getConfirmationToken(registrationId: string) {
  const raw = await token();
  if (!raw) return null;
  const db = createPrivilegedClient();
  const { data, error } = await db.rpc("phase10_issue_participant_confirmation_token", {
    p_token: raw,
    p_registration_id: registrationId,
  } as never);
  if (error || !data) return null;
  return (data as { token?: string }).token ?? null;
}

export async function getScopedBooking(registrationId: string, confirmationToken: string) {
  if (!confirmationToken) return null;
  const db = createPrivilegedClient();
  const { data, error } = await db.rpc("get_participant_booking_by_confirmation", {
    p_confirmation_token: confirmationToken,
    p_registration_id: registrationId,
  } as never);
  return error || !data ? null : (data as ManagedBooking);
}

export async function getConfirmationParticipantId(confirmationToken: string) {
  if (!confirmationToken) return null;
  const db = createPrivilegedClient();
  const { data, error } = await db.rpc("get_confirmation_participant_id", {
    p_token: confirmationToken,
  } as never);
  return error || !data ? null : String(data);
}

export async function manageBooking(
  action: "CANCEL" | "RESTORE" | "TRANSFER",
  registrationId: string,
  targetEventId?: string,
  accessToken?: string,
) {
  const raw = accessToken ?? (await token());
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
  if (error || !data) return { error: mapBookingError(error?.message ?? "") };
  return data as Record<string, unknown>;
}
