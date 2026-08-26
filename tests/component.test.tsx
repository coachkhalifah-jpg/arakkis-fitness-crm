import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RemoveRosterAction } from "@/components/admin/remove-roster-action";
import { AdminWorkspaceMenu } from "@/components/admin/admin-workspace-menu";
import { VenueSelect } from "@/components/admin/event-form-fields";
import { RegistrationForm } from "@/components/registration/registration-form";
import { RecurrenceScheduleManager } from "@/components/admin/recurrence-schedule-manager";

vi.mock("@/lib/registration/device-actions", () => ({
  forgetDeviceAction: vi.fn(async () => undefined),
}));

vi.mock("@/lib/services/recurrence-actions", () => ({
  addScheduleRule: vi.fn(),
  changeScheduleRule: vi.fn(),
  extendSeriesEndDate: vi.fn(),
  stopScheduleRule: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin",
}));
import { Button } from "@/components/ui/button";
import { FloatingBackButton } from "@/components/registration/floating-back-button";
import { RosterStatusCarousel } from "@/components/admin/roster-status-carousel";
import { ManageEventRosterDialog } from "@/components/admin/manage-event-roster-dialog";
import { DesignAssetUploadForm } from "@/components/admin/design-asset-upload-form";
import { RecurringScheduleFields } from "@/components/admin/recurring-schedule-fields";
import { EventCarousel } from "@/components/events/event-carousel";
import { WhatToBring } from "@/components/registration/what-to-bring";
import { legalDocuments } from "@/lib/legal/documents";
import { googleMapsDirectionsUrl } from "@/lib/registration/maps";
import {
  BookingScheduleList,
  UpNextBookingCard,
} from "@/components/registration/booking-schedule-list";
import { splitManagedBookings } from "@/lib/registration/booking-presentation";

const booking = (
  overrides: Partial<Parameters<typeof BookingScheduleList>[0]["bookings"][number]> = {},
) => ({
  registration_id: "registration-a",
  event_id: "event-a",
  name: "Morning Flow",
  starts_at: "2026-08-24T13:00:00.000Z",
  ends_at: "2026-08-24T14:00:00.000Z",
  timezone: "America/New_York",
  venue_name: "The Garden Studio",
  venue_street: "1 Main Street",
  venue_city: "Albany",
  venue_state: "NY",
  venue_postal_code: "12207",
  host_organization_name: "Arakkis",
  location_updated: false,
  registration_status: "REGISTERED",
  registration_outcome: "ACTIVE",
  series_slug: null,
  ...overrides,
});

describe("Button", () => {
  it("renders an accessible button", () => {
    render(<Button>Continue</Button>);
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("exposes semantic variants and keeps loading buttons disabled", () => {
    render(
      <>
        <Button variant="secondary">Cancel</Button>
        <Button variant="destructive">Delete</Button>
        <Button loading>Saving</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("ui-button-secondary");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("ui-button-destructive");
    expect(screen.getByRole("button", { name: "Saving" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Saving" })).toBeDisabled();
  });
});

describe("presentation controls", () => {
  it("cycles keyboard focus through roster controls without refocusing close", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const action = vi.fn(async () => undefined);
    const removeAction = vi.fn(async () => ({}));
    render(
      <ManageEventRosterDialog
        open
        onClose={vi.fn()}
        eventId="event-a"
        eventName="Open Studio"
        rows={[
          {
            id: "registration-a",
            participantName: "Ava Stone",
            phone: "+15185550101",
            email: "ava@example.test",
            registrationStatus: "REGISTERED",
            attendanceStatus: "NOT_RECORDED",
            registeredAt: "2026-08-20T12:00:00.000Z",
            firstClass: true,
          },
        ]}
        dateTime="Wed · Aug 20 · 6:30 PM"
        venue="Demo Studio"
        attendanceState="OPEN"
        registered={1}
        checkedIn={0}
        capacity={20}
        canEdit
        checkInAction={action}
        removeRegistrationAction={removeAction}
        canRemoveRegistration
      />,
    );

    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", { name: "Close event roster" });
    const checkIn = within(dialog).getByRole("button", { name: "Check in" });
    const more = within(dialog).getByLabelText("More actions for Ava Stone");
    expect(close).toHaveFocus();

    await user.tab();
    expect(checkIn).toHaveFocus();
    await user.tab();
    expect(more).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();

    await user.tab({ shift: true });
    expect(more).toHaveFocus();
  });

  it("keeps the series schedule readable and read-only for non-System Admins", () => {
    render(
      <RecurrenceScheduleManager
        seriesId="series-a"
        seriesEndsOn="2026-09-30"
        timezone="America/New_York"
        canMutate={false}
        rules={[
          {
            id: "rule-a",
            weekday: 1,
            local_start_time: "18:00:00",
            local_end_time: "19:00:00",
            effective_start_date: "2026-08-24",
            effective_end_date: null,
            supersedes_rule_id: null,
          },
        ]}
        occurrences={[
          {
            id: "occurrence-a",
            starts_at: "2026-08-24T22:00:00.000Z",
            generated_local_date: "2026-08-24",
            schedule_rule_id: "rule-a",
            active_bookings: 1,
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Manage series schedule" })).toBeInTheDocument();
    expect(screen.getByText(/1 booked date\(s\) remain unchanged/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add day & time/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
  });

  it("keeps stopped and successor rules visible without mutation controls", () => {
    render(
      <RecurrenceScheduleManager
        seriesId="series-history"
        seriesEndsOn="2026-09-30"
        timezone="America/New_York"
        canMutate={true}
        rules={[
          {
            id: "rule-thursday",
            weekday: 4,
            local_start_time: "18:00:00",
            local_end_time: "19:00:00",
            effective_start_date: "2026-08-20",
            effective_end_date: "2026-08-27",
            supersedes_rule_id: null,
          },
          {
            id: "rule-friday",
            weekday: 5,
            local_start_time: "18:00:00",
            local_end_time: "19:00:00",
            effective_start_date: "2026-08-28",
            effective_end_date: "2026-09-18",
            supersedes_rule_id: "rule-thursday",
          },
          {
            id: "rule-monday",
            weekday: 1,
            local_start_time: "18:00:00",
            local_end_time: "19:00:00",
            effective_start_date: "2026-08-24",
            effective_end_date: null,
            supersedes_rule_id: null,
          },
        ]}
        occurrences={[]}
      />,
    );

    expect(screen.getByText("Thursday · 6:00 PM–7:00 PM")).toBeInTheDocument();
    expect(screen.getByText("Friday · 6:00 PM–7:00 PM")).toBeInTheDocument();
    expect(screen.getAllByText("Monday · 6:00 PM–7:00 PM")).toHaveLength(2);
    expect(screen.getAllByText(/· Stopped/)).toHaveLength(2);
    expect(screen.getByText("Successor of a previous schedule")).toBeInTheDocument();
    expect(screen.getByText("Successor effective 2026-08-28")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Change" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Stop" })).toHaveLength(1);
  });

  it("opens the series end-date extension control for System Admins", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    cleanup();
    render(
      <RecurrenceScheduleManager
        seriesId="series-extend"
        seriesEndsOn="2026-08-25"
        timezone="America/New_York"
        canMutate={true}
        rules={[]}
        occurrences={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Extend series/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText("New series end date")).toHaveValue("2026-08-25");
    expect(within(dialog).getByRole("button", { name: "Extend series" })).toBeInTheDocument();
  });

  it("adds and removes recurring schedule rows only when recurring mode is enabled", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(
      <form>
        <input type="checkbox" name="recurring" aria-label="recurring" />
        <input name="startLocal" value="2026-08-24T19:00" readOnly />
        <input name="endLocal" value="2026-08-24T20:00" readOnly />
        <input name="recurrenceEndsOn" />
        <RecurringScheduleFields />
      </form>,
    );
    const add = screen.getByRole("button", { name: "+ Add day & time" });
    expect(add).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "recurring" }));
    expect(add).toBeEnabled();
    await waitFor(() =>
      expect(
        document.querySelector<HTMLInputElement>('input[name="recurrenceEndsOn"]'),
      ).toBeRequired(),
    );
    window.dispatchEvent(
      new CustomEvent("arakkis:schedule-time-change", {
        detail: { start: "2026-08-24T19:00", end: "2026-08-27T20:00" },
      }),
    );
    await waitFor(() =>
      expect(
        document.querySelector<HTMLInputElement>('input[name="recurrenceEndsOn"]')?.value,
      ).toBe("2026-08-27"),
    );
    await user.click(add);
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(screen.getByLabelText("Schedule row 2 start time")).toHaveValue("7:00 PM");
    expect(screen.getByLabelText("Schedule row 2 end time")).toHaveValue("8:00 PM");
    await user.click(screen.getByRole("button", { name: "Remove schedule row 2" }));
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

  it("clears remembered participant UI immediately after forgetting the device", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(
      <RegistrationForm
        events={[
          {
            id: "event-a",
            name: "Demo Recurring",
            starts_at: "2026-08-20T18:00:00.000Z",
            ends_at: "2026-08-20T19:00:00.000Z",
            timezone: "America/New_York",
            venue_name: "Demo Garden Studio",
            host_organization_name: "Demo Organization",
            active_registration_count: 1,
            capacity: 20,
            availability: "OPEN",
            visibility: "PUBLIC",
          },
        ]}
        idempotencyKey="idempotency-a"
        publicSlug="demo-recurring"
        rememberedFirstName="Maya"
        rememberedGoals="Build consistency"
        legalDocuments={legalDocuments}
        legalPackage={{
          id: "package-a",
          version: "1",
          effective_at: "2026-01-01T00:00:00.000Z",
          content_hash: "hash-a",
          components: ["EOKE_PARTICIPATION_WAIVER"].map((type, index) => ({
            id: `component-${index}`,
            type,
            version: 1,
            text: "I agree",
            effective_at: "2026-01-01T00:00:00.000Z",
          })),
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Continue as Maya" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Forget this device" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Continue as Maya" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Book Class" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /Continue as/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("First name")).not.toBeDisabled();
    cleanup();
  });

  it("separates Organization Venues and Public Venues in Event selection", () => {
    render(
      <VenueSelect
        aria-label="Venue"
        organizationId="org-a"
        venues={[
          {
            id: "venue-a",
            name: "Main Gym",
            organization_id: "org-a",
            timezone: "America/New_York",
          },
          {
            id: "venue-public",
            name: "Jefferson Tennis Courts",
            organization_id: null,
            timezone: "America/New_York",
          },
          {
            id: "venue-b",
            name: "Other Gym",
            organization_id: "org-b",
            timezone: "America/New_York",
          },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: /Organization Venues/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Public Venues" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Main Gym/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Jefferson Tennis Courts/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Other Gym/ })).not.toBeInTheDocument();
  });

  it("opens the scoped operations menu and returns focus on Escape", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<AdminWorkspaceMenu items={[{ href: "/admin/events", label: "Events" }]} />);
    const trigger = screen.getByRole("button", { name: "Open operations menu" });
    await user.click(trigger);
    await waitFor(
      () =>
        expect(screen.getByRole("link", { name: "Events" })).toHaveAttribute(
          "href",
          "/admin/events",
        ),
      { timeout: 3000 },
    );
    expect(
      screen.getByRole("dialog").querySelector(".admin-workspace-menu-close"),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(
      () => expect(screen.queryByRole("link", { name: "Events" })).not.toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(screen.getByRole("button", { name: "Open operations menu" })).toHaveFocus();
    cleanup();
  });

  it("keeps roster removal subordinate and identifies the participant and event", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const action = vi.fn(async () => ({ success: "removed" }));
    render(
      <RemoveRosterAction
        action={action}
        eventId="event-a"
        eventName="Morning Flow"
        registrationId="registration-a"
        participantName="Ava Stone"
      />,
    );
    expect(document.querySelector("details")).not.toHaveAttribute("open");
    await user.click(screen.getByText("•••", { exact: true }));
    expect(screen.getByRole("button", { name: "Remove from roster" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("event-a")).toBeInTheDocument();
    expect(screen.getByDisplayValue("registration-a")).toBeInTheDocument();
  });

  it("submits the managed event id for event-only image uploads", () => {
    render(
      <DesignAssetUploadForm
        events={[{ id: "event-a", name: "Event A" }]}
        eventOnly
        eventId="event-a"
        intentToken="intent-a"
      />,
    );
    expect(document.querySelector('input[name="eventId"]')).toHaveValue("event-a");
    expect(document.querySelector('input[name="eventImageIntent"]')).toHaveValue("intent-a");
    expect(document.querySelector('input[name="operation"]')).toHaveValue(
      "EVENT_IMAGE_REPLACEMENT",
    );
    expect(screen.getByRole("combobox", { name: "Asset type" })).toHaveValue("EVENT_IMAGE_DESKTOP");
  });

  it("labels the icon-only public back control", () => {
    render(<FloatingBackButton />);
    expect(screen.getByRole("link", { name: "Back to events" })).toHaveAttribute("href", "/events");
  });

  it("exposes real roster groups and expands the selected preview in place", async () => {
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
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Attended roster" })).toBeInTheDocument();
    expect(screen.getByText("Ava Stone")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close roster group" }));
    expect(screen.queryByRole("region", { name: "Attended roster" })).not.toBeInTheDocument();
  });
});

describe("confirmation card system", () => {
  it("shows the approved What to bring preview while collapsed", () => {
    render(
      <WhatToBring eventId="confirmation" instructions={["Gloves", "Wraps", "Water", "A towel"]} />,
    );
    const trigger = screen.getByRole("button", { name: /Gloves • Wraps • Water \+ more/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Gloves • Wraps • Water + more")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-controls", "what-to-bring-confirmation");
    expect(trigger.querySelector(".arakkis-disclosure-toggle-icon")).toHaveTextContent("+");
    expect(trigger.querySelector(".arakkis-disclosure-toggle-icon")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("builds only the approved Google Maps directions URL", () => {
    expect(googleMapsDirectionsUrl("1 Main Street, Albany, NY 12207")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=1%20Main%20Street%2C%20Albany%2C%20NY%2012207",
    );
    expect(googleMapsDirectionsUrl(null)).toBeNull();
  });
});

describe("public event card prototype", () => {
  it("uses the whole event card as the existing selection link", () => {
    render(
      <EventCarousel
        events={[
          {
            id: "event-a",
            name: "Morning Flow",
            date: { weekday: "Tue", day: "18", month: "Aug" },
            time: "2:00 PM",
            spots: 19,
            href: "/register/morning-flow",
            availability: "OPEN",
            titleColor: "#123456",
          },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /Tue/ })).toHaveAttribute(
      "href",
      "/register/morning-flow",
    );
    expect(
      screen.queryByRole("button", { name: /view class|view details/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Morning Flow")).toHaveStyle({ color: "#123456" });
  });
});

describe("manage bookings hierarchy", () => {
  it("selects the nearest active booking and excludes it from the remaining list", () => {
    const result = splitManagedBookings([
      booking({ registration_id: "later", starts_at: "2026-08-25T13:00:00.000Z" }),
      booking({ registration_id: "sooner", starts_at: "2026-08-24T13:00:00.000Z" }),
    ]);
    expect(result.upNext?.registration_id).toBe("sooner");
    expect(result.remainingActive.map((item) => item.registration_id)).toEqual(["later"]);
  });

  it("excludes cancelled bookings from Up Next and active My Bookings", () => {
    const result = splitManagedBookings([
      booking({ registration_id: "cancelled", registration_outcome: "PARTICIPANT_CANCELLED" }),
      booking({ registration_id: "active" }),
    ]);
    expect(result.upNext?.registration_id).toBe("active");
    expect(result.remainingActive).toHaveLength(0);
    expect(result.cancelled.map((item) => item.registration_id)).toEqual(["cancelled"]);
  });

  it("keeps the up-next card and schedule rows on canonical detail routes", () => {
    const upNextRender = render(
      <UpNextBookingCard booking={booking({ registration_id: "next" })} />,
    );
    expect(within(upNextRender.container).getByRole("link")).toHaveAttribute(
      "href",
      "/manage-bookings/next",
    );
    upNextRender.unmount();
    const listRender = render(
      <BookingScheduleList bookings={[booking({ registration_id: "other" })]} />,
    );
    expect(
      within(listRender.container).getByRole("link", {
        name: "View booking details for Morning Flow",
      }),
    ).toHaveAttribute("href", "/manage-bookings/other");
  });

  it("keeps cancellation independent and confirms before submitting", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const renderResult = render(
      <UpNextBookingCard booking={booking({ registration_id: "confirm-first" })} />,
    );
    const view = within(renderResult.container);

    expect(view.getByRole("link")).toHaveAttribute("href", "/manage-bookings/confirm-first");
    expect(view.getByRole("button", { name: "Cancel booking" })).toBeInTheDocument();
    expect(view.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(view.getByRole("button", { name: "Cancel booking" }));
    const dialog = view.getByRole("dialog", { name: "Cancel this class?" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Keep my booking" })).toHaveFocus();
    expect(within(dialog).getByRole("button", { name: "Cancel booking" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Keep my booking" }));
    expect(view.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
