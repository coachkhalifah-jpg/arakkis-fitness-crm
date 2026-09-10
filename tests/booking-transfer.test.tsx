import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TransferBookingDialog } from "@/components/registration/transfer-booking-dialog";
import type { BookingAlternative, ManagedBooking } from "@/lib/registration/booking-management";

vi.mock("@/lib/registration/booking-actions", () => ({
  transferBookingAction: vi.fn(),
}));

const booking: ManagedBooking = {
  registration_id: "registration-1",
  event_id: "event-1",
  name: "Morning Flow",
  starts_at: "2099-08-30T14:00:00.000Z",
  ends_at: "2099-08-30T15:00:00.000Z",
  timezone: "America/New_York",
  venue_name: "Arakkis Studio",
  venue_street: "1 Main Street",
  venue_city: "Albany",
  venue_state: "NY",
  venue_postal_code: "12207",
  host_organization_name: "Arakkis",
  location_updated: false,
  registration_status: "REGISTERED",
  registration_outcome: "ACTIVE",
  series_slug: "morning-flow",
};

const alternative: BookingAlternative = {
  event_id: "event-2",
  name: "Morning Flow",
  starts_at: "2099-09-06T14:00:00.000Z",
  ends_at: "2099-09-06T15:00:00.000Z",
  timezone: "America/New_York",
  venue_name: "Arakkis Studio",
  venue_street: "1 Main Street",
  venue_city: "Albany",
  venue_state: "NY",
  venue_postal_code: "12207",
  host_organization_name: "Arakkis",
  capacity: 10,
  active_registration_count: 2,
  location_updated: false,
};

describe("TransferBookingDialog", () => {
  it("offers the server-filtered occurrence and preserves scoped access", () => {
    render(
      <TransferBookingDialog
        booking={booking}
        alternatives={[alternative]}
        accessToken="confirmation-token"
      />,
    );

    expect(
      screen.getByRole("heading", { name: /choose another class in this series/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /September 6/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Select a date")).toBeRequired();
    expect(screen.getByDisplayValue("confirmation-token")).toHaveAttribute("name", "accessToken");
  });
});
