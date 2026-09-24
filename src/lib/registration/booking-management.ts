import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/lib/db/server";
import { createPrivilegedClient } from "@/lib/db/privileged";
import { rememberedDeviceCookie } from "@/lib/registration/device";
import { logHostedAccessDiagnostic } from "@/lib/diagnostics/hosted-access";
import {
  managedBookingFromConfirmationEvent,
  type ConfirmationBookingEvent,
} from "@/lib/registration/confirmation-booking";
import { safeDate, safeTimezone } from "@/lib/registration/datetime";

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

export type BookingAlternative = {
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
  capacity: number;
  active_registration_count: number;
  location_updated: boolean;
};

export type BookingActionError = {
  error: string;
};

/** Normalize RPC booking payloads so UI date/venue formatting cannot throw. */
export function normalizeManagedBooking(
  booking: Partial<ManagedBooking> &
    Pick<
      ManagedBooking,
      "registration_id" | "event_id" | "registration_status" | "registration_outcome"
    >,
): ManagedBooking {
  return {
    registration_id: booking.registration_id,
    event_id: booking.event_id,
    name: booking.name?.trim() || "Class",
    description: booking.description ?? null,
    participant_instructions: booking.participant_instructions ?? null,
    starts_at: safeDate(booking.starts_at).toISOString(),
    ends_at: safeDate(booking.ends_at).toISOString(),
    timezone: safeTimezone(booking.timezone),
    venue_name: booking.venue_name ?? "",
    venue_street: booking.venue_street ?? "",
    venue_city: booking.venue_city ?? "",
    venue_state: booking.venue_state ?? "",
    venue_postal_code: booking.venue_postal_code ?? "",
    host_organization_name: booking.host_organization_name ?? "",
    location_updated: Boolean(booking.location_updated),
    registration_status: booking.registration_status,
    registration_outcome: booking.registration_outcome,
    series_slug: booking.series_slug ?? null,
    communication_url: booking.communication_url ?? null,
    communication_label: booking.communication_label ?? null,
  };
}

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
  if (normalized.includes("alternative venue"))
    return "That occurrence's venue is no longer available.";
  if (normalized.includes("alternative occurrence"))
    return "That occurrence is no longer available. Choose another class in this series.";
  if (normalized.includes("no longer bookable"))
    return "This booking is no longer available to restore.";
  if (normalized.includes("full"))
    return "This class is now full, so the booking cannot be moved or restored.";
  if (normalized.includes("already exists"))
    return "You already have an active booking for this class.";
  return "We couldn't update this booking. Please refresh and try again.";
}

async function token(correlationId?: string) {
  try {
    return (await cookies()).get(rememberedDeviceCookie)?.value ?? null;
  } catch (error) {
    if (correlationId)
      logHostedAccessDiagnostic({
        correlation_id: correlationId,
        boundary: "booking_management",
        outcome_category: "cookie_failure",
        confirmation_cookie_present: false,
      });
    throw error;
  }
}

async function rpcWithDeviceCapabilityFallback<T>(
  rpcName: string,
  args: Record<string, unknown>,
): Promise<{ data: T | null; error: { message: string } | null }> {
  // Device cookie token is the capability (migration 0074). Prefer anon, then
  // service-role, matching confirmation-bearer device issue (0073).
  const anon = await createClient();
  const primary = await anon.rpc(rpcName, args as never);
  if (!primary.error && primary.data) {
    return { data: primary.data as T, error: null };
  }
  const privileged = createPrivilegedClient();
  const fallback = await privileged.rpc(rpcName, args as never);
  return {
    data: (fallback.data as T | null) ?? null,
    error: fallback.error ?? primary.error,
  };
}

export async function getManagedBookings(correlationId = crypto.randomUUID()) {
  const raw = await token(correlationId);
  if (!raw) return null;
  const { data, error } = await rpcWithDeviceCapabilityFallback<{
    participant_id: string;
    bookings: ManagedBooking[];
  }>("get_participant_upcoming_bookings", { p_token: raw });
  logHostedAccessDiagnostic({
    correlation_id: correlationId,
    boundary: "booking_management",
    outcome_category: error ? "rpc_failure" : data ? "success" : "data_state_failure",
    booking_rpc_attempted: true,
    booking_rpc_status: error ? "error" : data ? "success" : "not_found",
    booking_result: data ? "resolved" : error ? "error" : "not_found",
  });
  return error || !data
    ? null
    : {
        participant_id: data.participant_id,
        bookings: (data.bookings ?? []).map((booking) =>
          normalizeManagedBooking(booking as ManagedBooking),
        ),
      };
}

export async function getBookingAlternatives(registrationId: string, accessToken?: string) {
  const raw = accessToken ?? (await token());
  if (!raw) return null;
  const { data, error } = await rpcWithDeviceCapabilityFallback<BookingAlternative[]>(
    "get_participant_booking_alternatives",
    { p_token: raw, p_registration_id: registrationId },
  );
  return error || !data ? null : data;
}

export async function getConfirmationToken(registrationId: string) {
  const raw = await token();
  if (!raw) return null;
  const { data, error } = await rpcWithDeviceCapabilityFallback<{ token?: string }>(
    "phase10_issue_participant_confirmation_token",
    { p_token: raw, p_registration_id: registrationId },
  );
  if (error || !data) return null;
  return data.token ?? null;
}

async function bookingFromConfirmationFallback(
  registrationId: string,
  confirmationToken: string,
): Promise<ManagedBooking | null> {
  // Use the same anon-executable confirmation RPC that already rendered the
  // confirmation page. This recovers View booking when the service-role scoped
  // booking RPC is missing, ungranted, or otherwise unavailable on hosted.
  const db = await createClient();
  const { data, error } = await db.rpc("get_registration_confirmation", {
    p_token: confirmationToken,
  } as never);
  if (error || !data) return null;
  const events = ((data as { events?: ConfirmationBookingEvent[] }).events ?? []).filter(
    (event) => event.success && event.registration_id === registrationId,
  );
  const match = events[0];
  return match ? managedBookingFromConfirmationEvent(match) : null;
}

export async function getScopedBooking(
  registrationId: string,
  confirmationToken: string,
  correlationId = crypto.randomUUID(),
) {
  if (!confirmationToken) {
    logHostedAccessDiagnostic({
      correlation_id: correlationId,
      boundary: "booking_management",
      outcome_category: "route_failure",
      booking_rpc_attempted: false,
      registration_match: false,
      booking_result: "not_found",
    });
    return null;
  }
  logHostedAccessDiagnostic({
    correlation_id: correlationId,
    boundary: "booking_management",
    booking_rpc_attempted: true,
  });
  const db = createPrivilegedClient();
  const { data, error } = await db.rpc("get_participant_booking_by_confirmation", {
    p_confirmation_token: confirmationToken,
    p_registration_id: registrationId,
  } as never);
  if (!error && data) {
    logHostedAccessDiagnostic({
      correlation_id: correlationId,
      boundary: "booking_management",
      outcome_category: "success",
      booking_rpc_status: "success",
      registration_match: true,
      booking_result: "resolved",
    });
    return normalizeManagedBooking(data as ManagedBooking);
  }

  const fallback = await bookingFromConfirmationFallback(registrationId, confirmationToken);
  const bookingRpcStatus = fallback
    ? "success"
    : error
      ? /expired/i.test(error.message)
        ? "expired"
        : /token|invalid/i.test(error.message)
          ? "invalid"
          : /scope|registration/i.test(error.message)
            ? "scope_mismatch"
            : "error"
      : "not_found";
  logHostedAccessDiagnostic({
    correlation_id: correlationId,
    boundary: "booking_management",
    outcome_category: fallback ? "success" : error ? "rpc_failure" : "data_state_failure",
    booking_rpc_status: bookingRpcStatus,
    registration_match: Boolean(fallback),
    booking_result: fallback ? "resolved" : error ? "error" : "not_found",
  });
  return fallback ? normalizeManagedBooking(fallback) : null;
}

export async function getConfirmationParticipantId(
  confirmationToken: string,
  correlationId = crypto.randomUUID(),
) {
  if (!confirmationToken) return null;
  try {
    const db = createPrivilegedClient();
    const { data, error } = await db.rpc("get_confirmation_participant_id", {
      p_token: confirmationToken,
    } as never);
    if (error || !data) {
      logHostedAccessDiagnostic({
        correlation_id: correlationId,
        boundary: "confirmation_route",
        outcome_category: error ? "rpc_failure" : "data_state_failure",
      });
      return null;
    }
    return String(data);
  } catch {
    logHostedAccessDiagnostic({
      correlation_id: correlationId,
      boundary: "confirmation_route",
      outcome_category: "rpc_failure",
    });
    return null;
  }
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
  const { data, error } = await rpcWithDeviceCapabilityFallback<Record<string, unknown>>(
    "manage_participant_booking",
    {
      p_token: raw,
      p_action: action,
      p_registration_id: registrationId,
      p_target_event_id: targetEventId ?? null,
    },
  );
  if (error || !data) return { error: mapBookingError(error?.message ?? "") };
  return data;
}
