import "server-only";

import { cookies } from "next/headers";
import { createPrivilegedClient } from "@/lib/db/privileged";
import { rememberedDeviceCookie } from "@/lib/registration/device";
import { logHostedAccessDiagnostic } from "@/lib/diagnostics/hosted-access";

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

export async function getManagedBookings(correlationId = crypto.randomUUID()) {
  const raw = await token(correlationId);
  if (!raw) return null;
  const db = createPrivilegedClient();
  const { data, error } = await db.rpc("get_participant_upcoming_bookings", {
    p_token: raw,
  } as never);
  logHostedAccessDiagnostic({
    correlation_id: correlationId,
    boundary: "booking_management",
    outcome_category: error ? "rpc_failure" : data ? "success" : "data_state_failure",
    booking_rpc_attempted: true,
    booking_rpc_status: error ? "error" : data ? "success" : "not_found",
    booking_result: data ? "resolved" : error ? "error" : "not_found",
  });
  return error || !data ? null : (data as { participant_id: string; bookings: ManagedBooking[] });
}

export async function getBookingAlternatives(registrationId: string, accessToken?: string) {
  const raw = accessToken ?? (await token());
  if (!raw) return null;
  const db = createPrivilegedClient();
  const { data, error } = await db.rpc("get_participant_booking_alternatives", {
    p_token: raw,
    p_registration_id: registrationId,
  } as never);
  return error || !data ? null : (data as BookingAlternative[]);
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
  const bookingRpcStatus = error
    ? /expired/i.test(error.message)
      ? "expired"
      : /token|invalid/i.test(error.message)
        ? "invalid"
        : /scope|registration/i.test(error.message)
          ? "scope_mismatch"
          : "error"
    : data
      ? "success"
      : "not_found";
  logHostedAccessDiagnostic({
    correlation_id: correlationId,
    boundary: "booking_management",
    outcome_category: error ? "rpc_failure" : data ? "success" : "data_state_failure",
    booking_rpc_status: bookingRpcStatus,
    registration_match: Boolean(data),
    booking_result: data ? "resolved" : error ? "error" : "not_found",
  });
  return error || !data ? null : (data as ManagedBooking);
}

export async function getConfirmationParticipantId(
  confirmationToken: string,
  correlationId = crypto.randomUUID(),
) {
  if (!confirmationToken) return null;
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
  }
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
