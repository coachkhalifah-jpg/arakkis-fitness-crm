import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ParticipantEventsView } from "@/components/events/participant-events-view";

afterEach(() => cleanup());

const baseEvent = {
  id: "event-1",
  name: "Morning Strength",
  date: { weekday: "Mon", day: "12", month: "Jan" },
  time: "9:00 AM",
  organizationName: "Studio",
  venueName: "Main Room",
  spots: 4,
  href: "/register/morning-strength",
  availability: "OPEN",
};

describe("ParticipantEventsView booked state", () => {
  it("marks already-booked classes and links to manage instead of register", () => {
    render(
      <ParticipantEventsView
        thisWeek={[
          {
            ...baseEvent,
            manageHref: "/manage-bookings/reg-1",
          },
        ]}
        upcomingByOrganization={[]}
      />,
    );
    const card = screen.getByRole("link", { name: /morning strength/i });
    expect(card).toHaveAttribute("href", "/manage-bookings/reg-1");
    expect(card).toHaveTextContent("Booked");
    expect(card).toHaveTextContent("Manage booking");
  });
});
