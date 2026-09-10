import { describe, expect, it } from "vitest";
import { isUnavailableEvent } from "@/lib/registration/availability";
import { mapBookingError } from "@/lib/registration/booking-management";
import { bookingManagementHref } from "@/lib/registration/booking-links";

describe("participant finishing batch", () => {
  it.each([
    "CLOSED",
    "PAUSED",
    "FULL",
    "NOT_YET_OPEN",
    "UNPUBLISHED",
    "CANCELLED",
    "LEGALLY_BLOCKED",
  ])("disables recurring occurrence availability state %s", (availability) => {
    expect(isUnavailableEvent({ availability, active_registration_count: 0, capacity: 10 })).toBe(
      true,
    );
  });

  it("keeps an available occurrence selectable", () => {
    expect(
      isUnavailableEvent({ availability: "OPEN", active_registration_count: 2, capacity: 10 }),
    ).toBe(false);
  });

  it("creates a canonical token-scoped booking-management link", () => {
    expect(bookingManagementHref("registration/1", "confirmation_token_123")).toBe(
      "/manage-bookings/registration%2F1?token=confirmation_token_123",
    );
    expect(bookingManagementHref("", "confirmation_token_123")).toBeNull();
    expect(bookingManagementHref("registration-1", "")).toBeNull();
  });

  it.each([
    ["booking is full", "This class is now full, so the booking cannot be moved or restored."],
    ["booking is no longer bookable", "This booking is no longer available to restore."],
    [
      "booking access is invalid",
      "Your booking access has expired or is no longer valid. Save this device again from a confirmation page.",
    ],
    ["booking is not active", "This booking has already been cancelled or changed."],
    [
      "alternative occurrence is unavailable",
      "That occurrence is no longer available. Choose another class in this series.",
    ],
    ["alternative venue is unavailable", "That occurrence's venue is no longer available."],
  ])("maps booking failure %s without exposing RPC details", (raw, safe) => {
    expect(mapBookingError(raw)).toBe(safe);
  });
});
