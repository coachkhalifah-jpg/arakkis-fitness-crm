import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isHostedAccessCorrelationId,
  logHostedAccessDiagnostic,
} from "@/lib/diagnostics/hosted-access";
import { bookingManagementHref } from "@/lib/registration/booking-links";

describe("hosted access diagnostics", () => {
  afterEach(() => vi.restoreAllMocks());

  it("emits only approved status fields and never credential values", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logHostedAccessDiagnostic({
      correlation_id: "diagnostic-correlation-id",
      boundary: "registration_submission",
      outcome_category: "success",
      remember_requested: true,
      device_rpc_attempted: true,
      device_rpc_status: "success",
      cookie_set_attempted: true,
      cookie_set_completed: true,
      confirmation_cookie_present: true,
      remember_resolution: "matched",
      participant_match: true,
      booking_rpc_attempted: true,
      booking_rpc_status: "success",
      registration_match: true,
      booking_result: "resolved",
    });

    expect(info).toHaveBeenCalledOnce();
    const event = info.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(event).sort()).toEqual([
      "booking_result",
      "booking_rpc_attempted",
      "booking_rpc_status",
      "boundary",
      "confirmation_cookie_present",
      "cookie_set_attempted",
      "cookie_set_completed",
      "correlation_id",
      "device_rpc_attempted",
      "device_rpc_status",
      "outcome_category",
      "participant_match",
      "registration_match",
      "remember_requested",
      "remember_resolution",
    ]);
    expect(JSON.stringify(event)).not.toMatch(
      /token|cookie_value|password|email|phone|participant_id/i,
    );
  });

  it("preserves a safe correlation id across confirmation and booking routes", () => {
    const correlationId = "550e8400-e29b-41d4-a716-446655440000";

    expect(isHostedAccessCorrelationId(correlationId)).toBe(true);
    expect(isHostedAccessCorrelationId("not-a-correlation-id")).toBe(false);
    expect(bookingManagementHref("registration-id", "confirmation-token", correlationId)).toBe(
      "/manage-bookings/registration-id?token=confirmation-token&correlationId=550e8400-e29b-41d4-a716-446655440000",
    );
  });
});
