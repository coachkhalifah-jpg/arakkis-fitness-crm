import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markAttendance } from "@/lib/services/phase-5-actions";
import { CheckInButton } from "@/components/admin/check-in-button";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

vi.mock("@/lib/services/phase-5-actions", () => ({
  markAttendance: vi.fn(),
}));

describe("CheckInButton (UX-R003)", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    refresh.mockReset();
    vi.mocked(markAttendance).mockReset();
  });

  it("surfaces markAttendance error and errorAction instead of swallowing them", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    vi.mocked(markAttendance).mockResolvedValue({
      error: "Check-in is not open for this event.",
      errorAction: "Open check-in before recording attendance.",
      errorCode: "ATTENDANCE_NOT_OPEN",
    });

    render(
      <CheckInButton
        eventId="event-a"
        registrationId="registration-a"
        status="ATTENDED"
        className="event-roster-check-in-button"
      >
        Check in
      </CheckInButton>,
    );

    await user.click(screen.getByRole("button", { name: "Check in" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Check-in is not open for this event.");
    expect(alert).toHaveTextContent("Next: Open check-in before recording attendance.");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("disables the button while check-in is pending", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    let resolveAction: ((value: { success: string }) => void) | undefined;
    vi.mocked(markAttendance).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    render(
      <CheckInButton
        eventId="event-a"
        registrationId="registration-a"
        status="ATTENDED"
        className="event-roster-check-in-button"
        pendingLabel="Checking in…"
      >
        Check in
      </CheckInButton>,
    );

    const click = user.click(screen.getByRole("button", { name: "Check in" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Checking in…" })).toBeDisabled();
    });

    resolveAction?.({ success: "Attendance updated." });
    await click;
    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
  });
});
