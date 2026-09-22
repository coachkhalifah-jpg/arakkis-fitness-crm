import { describe, expect, it } from "vitest";
import { managedBookingFromConfirmationEvent } from "@/lib/registration/confirmation-booking";

describe("managedBookingFromConfirmationEvent", () => {
  it("maps a successful confirmation event into manage-booking detail fields", () => {
    const booking = managedBookingFromConfirmationEvent({
      event_id: "event-1",
      registration_id: "reg-1",
      success: true,
      name: "Morning Flow",
      description: "A class",
      participant_instructions: "Bring water",
      starts_at: "2026-10-01T17:00:00.000Z",
      ends_at: "2026-10-01T18:00:00.000Z",
      timezone: "America/Los_Angeles",
      venue_name: "Studio A",
      venue_street: "1 Main St",
      venue_city: "Portland",
      venue_state: "OR",
      venue_postal_code: "97201",
      host_organization_name: "Arakkis Demo",
      communication_url: "https://chat.example.com",
      communication_label: "Join group",
    });

    expect(booking).toMatchObject({
      registration_id: "reg-1",
      event_id: "event-1",
      name: "Morning Flow",
      registration_status: "REGISTERED",
      registration_outcome: "ACTIVE",
      host_organization_name: "Arakkis Demo",
      communication_label: "Join group",
    });
  });
});
