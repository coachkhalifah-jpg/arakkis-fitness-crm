import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ManagedBooking } from "@/lib/registration/booking-management";

const refresh = vi.fn();
const cancelBookingAction = vi.fn(async () => ({ success: true as const }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

vi.mock("@/lib/registration/booking-actions", () => ({
  cancelBookingAction: (...args: unknown[]) => cancelBookingAction(...args),
}));

import { CancelBookingDialog } from "@/components/registration/cancel-booking-dialog";

const booking: ManagedBooking = {
  registration_id: "registration-cancel",
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

describe("CancelBookingDialog completion", () => {
  afterEach(() => {
    cleanup();
    refresh.mockClear();
    cancelBookingAction.mockReset();
    cancelBookingAction.mockImplementation(async () => ({ success: true as const }));
  });

  it("clears pending, closes the dialog, and refreshes on success", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<CancelBookingDialog booking={booking} />);

    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel this class?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel booking" }));

    await waitFor(() => {
      expect(cancelBookingAction).toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("keeps the dialog open and surfaces the error when cancel fails", async () => {
    cancelBookingAction.mockImplementation(async () => ({
      error: "This booking can no longer be cancelled.",
    }));
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<CancelBookingDialog booking={booking} />);

    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel this class?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel booking" }));

    await waitFor(() => {
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "This booking can no longer be cancelled.",
      );
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
