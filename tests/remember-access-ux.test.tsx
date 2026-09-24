import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmationRememberDevice } from "@/components/registration/confirmation-remember-device";

vi.mock("@/lib/registration/actions", () => ({
  rememberDeviceOnConfirmation: vi.fn(),
}));

const confirmationPage = readFileSync(
  resolve(process.cwd(), "src/app/registration/confirmation/page.tsx"),
  "utf8",
);
const homePage = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
const eventsPage = readFileSync(resolve(process.cwd(), "src/app/events/page.tsx"), "utf8");
const manageBookingsPage = readFileSync(
  resolve(process.cwd(), "src/app/manage-bookings/page.tsx"),
  "utf8",
);

describe("remember and access UX (UAT-009)", () => {
  afterEach(() => cleanup());

  it("gates the confirmation Remember prompt on isRememberedParticipant", () => {
    expect(confirmationPage).toContain("successful.length > 0 && !isRememberedParticipant");
    expect(confirmationPage).toContain(
      'aria-label="Save your booking link"',
    );
    expect(confirmationPage).toContain("<ConfirmationRememberDevice");
    expect(confirmationPage).toMatch(
      /isRememberedParticipant[\s\S]*ConfirmationRememberDevice/,
    );
  });

  it("leads non-rememberers with Save your booking link and CopyBookingLink", () => {
    expect(confirmationPage).toContain("Save your booking link");
    expect(confirmationPage).toContain("{!isRememberedParticipant ? <CopyBookingLink");
    expect(confirmationPage).not.toContain("Keep your booking handy");
    expect(confirmationPage).not.toMatch(/magic[- ]link/i);
  });

  it("explains the 24h confirmation cliff without mandating Remember", () => {
    render(<ConfirmationRememberDevice token="tok" correlationId="corr" />);
    expect(screen.getByText("Save your booking link")).toBeInTheDocument();
    expect(screen.getByText(/expire in 24 hours/i)).toBeInTheDocument();
    expect(screen.getByText(/Remember this device is optional/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Remember this device/i })).toBeChecked();
    expect(screen.getByRole("button", { name: "Remember this device" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save on this device" })).not.toBeInTheDocument();
    expect(screen.queryByText(/magic[- ]link/i)).not.toBeInTheDocument();
  });

  it("exposes Forget this device on returning home and Events when remembered", () => {
    expect(homePage).toContain("ForgetDevice");
    expect(homePage).toContain("returning-lede");
    expect(eventsPage).toContain("ForgetDevice");
    expect(eventsPage).toContain("Welcome back, {remembered.first_name}");
  });

  it("uses calm recovery copy on disconnected manage-bookings and expired confirmation", () => {
    expect(manageBookingsPage).toContain("Open a booking with a saved link.");
    expect(manageBookingsPage).toContain("Remember this device");
    expect(manageBookingsPage).not.toContain("This device isn’t connected to your bookings yet.");
    expect(confirmationPage).toContain(
      "If you chose Remember this device on this browser, open View your bookings",
    );
    expect(confirmationPage).toContain("or use a booking link you saved earlier.");
    expect(homePage).toContain("Have a booking link?");
    expect(homePage).not.toContain("Manage your booking");
  });
});
