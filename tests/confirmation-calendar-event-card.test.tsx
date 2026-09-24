import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ParticipantEventCard } from "@/components/events/participant-event-card";

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
  imageUrl: "/admin-assets/event-cards/strength.svg",
};

describe("ParticipantEventCard confirmation calendar parity", () => {
  it("uses the shared event-card shell with Booked status and calendar actions", () => {
    const { container } = render(
      <ParticipantEventCard
        event={baseEvent}
        booked
        asLink={false}
        className="confirmation-calendar-row confirmation-calendar-session-card"
        footer={
          <span className="confirmation-calendar-actions">
            <a
              className="confirmation-calendar-link confirmation-calendar-link-primary"
              href="https://calendar.google.com/calendar/render?action=TEMPLATE"
              target="_blank"
              rel="noreferrer"
            >
              Google Calendar
            </a>
            <a
              className="confirmation-calendar-link confirmation-calendar-link-secondary"
              href="/registration/confirmation/ics?token=tok&event=event-1"
            >
              iCal
            </a>
          </span>
        }
      />,
    );

    const card = container.querySelector("article.event-card-shell.participant-event-card.is-booked");
    expect(card).toBeTruthy();
    expect(card).toHaveClass("confirmation-calendar-session-card");
    expect(screen.getByText("Booked")).toBeInTheDocument();
    expect(screen.queryByText("BOOKED")).not.toBeInTheDocument();
    expect(screen.queryByText("Manage booking")).not.toBeInTheDocument();

    const google = screen.getByRole("link", { name: "Google Calendar" });
    expect(google).toHaveAttribute("href", expect.stringContaining("calendar.google.com"));
    const ical = screen.getByRole("link", { name: "iCal" });
    expect(ical).toHaveAttribute(
      "href",
      "/registration/confirmation/ics?token=tok&event=event-1",
    );
  });
});
