import { describe, expect, it } from "vitest";
import {
  activeRegistrationIdByEventId,
  manageBookingHref,
} from "@/lib/registration/active-bookings";
import type { ManagedBooking } from "@/lib/registration/booking-management";

function booking(overrides: Partial<ManagedBooking>): ManagedBooking {
  return {
    registration_id: "reg-1",
    event_id: "event-1",
    name: "Class",
    starts_at: "2030-01-01T12:00:00Z",
    ends_at: "2030-01-01T13:00:00Z",
    timezone: "America/New_York",
    venue_name: "Studio",
    venue_street: "1 Main",
    venue_city: "Ottawa",
    venue_state: "ON",
    venue_postal_code: "K1A0A1",
    host_organization_name: "Org",
    location_updated: false,
    registration_status: "REGISTERED",
    registration_outcome: "ACTIVE",
    series_slug: "demo-recurring",
    ...overrides,
  };
}

describe("activeRegistrationIdByEventId", () => {
  it("maps only active registered bookings", () => {
    const map = activeRegistrationIdByEventId([
      booking({ registration_id: "keep", event_id: "a" }),
      booking({
        registration_id: "drop-cancelled",
        event_id: "b",
        registration_status: "CANCELLED",
      }),
      booking({
        registration_id: "drop-inactive",
        event_id: "c",
        registration_outcome: "CANCELLED",
      }),
    ]);
    expect([...map.entries()]).toEqual([["a", "keep"]]);
  });

  it("builds manage href with encoded registration id", () => {
    expect(manageBookingHref("reg/1")).toBe("/manage-bookings/reg%2F1");
  });
});
