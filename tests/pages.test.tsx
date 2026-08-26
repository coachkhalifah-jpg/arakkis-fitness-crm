import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import ManageBookingsPage from "@/app/manage-bookings/page";
import AccessDeniedPage from "@/app/admin/access-denied/page";
import { resolveRememberedParticipant } from "@/lib/registration/device";

vi.mock("@/lib/registration/device", () => ({
  resolveRememberedParticipant: vi.fn(),
}));

vi.mock("@/lib/registration/booking-management", () => ({
  getManagedBookings: vi.fn(),
}));

describe("foundation pages", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(resolveRememberedParticipant).mockResolvedValue(null);
  });

  it("renders the public landing page for an unknown participant", async () => {
    render(await HomePage());
    expect(screen.getByRole("heading", { name: /meet with purpose/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse events/i })).toHaveAttribute("href", "/events");
  });

  it("renders the access-denied state without exposing admin data", () => {
    render(<AccessDeniedPage />);
    expect(screen.getByRole("heading", { name: /access denied/i })).toBeInTheDocument();
    expect(screen.getByText(/does not have active administrator access/i)).toBeInTheDocument();
  });

  it("renders truthful booking recovery for an unremembered participant", async () => {
    render(await ManageBookingsPage());
    expect(
      screen.getByRole("heading", { name: /not connected to your bookings/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/saved confirmation or booking link/i)).toBeInTheDocument();
    const recovery = screen.getByRole("main", {
      name: /not connected to your bookings/i,
    });
    expect(within(recovery).getByRole("link", { name: /browse events/i })).toHaveAttribute(
      "href",
      "/events",
    );
  });
});
