import { afterEach, describe, expect, it, vi } from "vitest";
import { logHostedAccessDiagnostic } from "@/lib/diagnostics/hosted-access";

describe("hosted access diagnostics", () => {
  afterEach(() => vi.restoreAllMocks());

  it("emits only approved status fields and never credential values", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logHostedAccessDiagnostic({
      correlation_id: "diagnostic-correlation-id",
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
      "confirmation_cookie_present",
      "cookie_set_attempted",
      "cookie_set_completed",
      "correlation_id",
      "device_rpc_attempted",
      "device_rpc_status",
      "participant_match",
      "registration_match",
      "remember_requested",
      "remember_resolution",
    ]);
    expect(JSON.stringify(event)).not.toMatch(
      /token|cookie_value|password|email|phone|participant_id/i,
    );
  });
});
