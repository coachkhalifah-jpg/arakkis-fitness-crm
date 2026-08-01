import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { FloatingBackButton } from "@/components/registration/floating-back-button";
import { RosterStatusCarousel } from "@/components/admin/roster-status-carousel";

describe("Button", () => {
  it("renders an accessible button", () => {
    render(<Button>Continue</Button>);
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });
});

describe("presentation controls", () => {
  it("labels the icon-only public back control", () => {
    render(<FloatingBackButton />);
    expect(screen.getByRole("link", { name: "Back to events" })).toHaveAttribute("href", "/events");
  });

  it("exposes real roster groups and opens the selected preview", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(
      <RosterStatusCarousel
        people={[
          {
            id: "1",
            name: "Ava Stone",
            phone: null,
            registrationStatus: "REGISTERED",
            attendanceStatus: "ATTENDED",
            firstClass: true,
          },
          {
            id: "2",
            name: "Lee Park",
            phone: null,
            registrationStatus: "CANCELLED",
            attendanceStatus: "NOT_RECORDED",
            firstClass: false,
          },
        ]}
      />,
    );
    expect(screen.getByRole("tab", { name: /registered/i })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /attended/i }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Attended");
    expect(screen.getByText("Ava Stone")).toBeInTheDocument();
  });
});
