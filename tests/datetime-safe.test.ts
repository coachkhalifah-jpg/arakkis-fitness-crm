import { describe, expect, it } from "vitest";
import { formatInTimezone, safeDate, safeTimezone } from "@/lib/registration/datetime";
import { managedBookingFromConfirmationEvent } from "@/lib/registration/confirmation-booking";
import { normalizeManagedBooking } from "@/lib/registration/booking-management";

describe("safeTimezone / safeDate", () => {
  it("falls back to UTC for nullish or invalid timezones", () => {
    expect(safeTimezone(null)).toBe("UTC");
    expect(safeTimezone("")).toBe("UTC");
    expect(safeTimezone("Not/AZone")).toBe("UTC");
    expect(safeTimezone("America/New_York")).toBe("America/New_York");
  });

  it("falls back to epoch for nullish or invalid timestamps", () => {
    expect(safeDate(null).toISOString()).toBe(new Date(0).toISOString());
    expect(safeDate("").toISOString()).toBe(new Date(0).toISOString());
    expect(safeDate("not-a-date").toISOString()).toBe(new Date(0).toISOString());
  });

  it("formats without throwing on bad inputs", () => {
    expect(() => formatInTimezone(null, null, { weekday: "short" })).not.toThrow();
    expect(() => formatInTimezone("", "Not/AZone", { hour: "numeric" })).not.toThrow();
  });
});

describe("managed booking null hardening", () => {
  it("maps confirmation events with null venue/timezone without throwing", () => {
    const booking = managedBookingFromConfirmationEvent({
      event_id: "event-1",
      registration_id: "reg-1",
      success: true,
      name: null,
      starts_at: null,
      ends_at: null,
      timezone: null,
      venue_name: null,
      venue_street: null,
      venue_city: null,
      venue_state: null,
      venue_postal_code: null,
      host_organization_name: null,
    });
    expect(booking.name).toBe("Class");
    expect(booking.timezone).toBe("UTC");
    expect(booking.venue_name).toBe("");
    expect(() =>
      formatInTimezone(booking.starts_at, booking.timezone, { weekday: "short" }),
    ).not.toThrow();
  });

  it("normalizes partial managed bookings for UI rendering", () => {
    const booking = normalizeManagedBooking({
      registration_id: "reg-1",
      event_id: "event-1",
      registration_status: "REGISTERED",
      registration_outcome: "ACTIVE",
      name: null as unknown as string,
      timezone: null as unknown as string,
      starts_at: "" as unknown as string,
      venue_name: null as unknown as string,
      host_organization_name: null as unknown as string,
    });
    expect(booking.name).toBe("Class");
    expect(booking.timezone).toBe("UTC");
    expect(booking.venue_name).toBe("");
    expect(booking.starts_at).toBe(new Date(0).toISOString());
  });
});
