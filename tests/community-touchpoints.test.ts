import { describe, expect, it } from "vitest";
import {
  projectCommunityTouchpoints,
  type CommunityAttendance,
  type CommunityEvent,
  type CommunityRegistration,
} from "@/lib/services/community-touchpoints";

const now = new Date("2026-08-19T12:00:00.000Z");

function event(
  id: string,
  startsAt: string,
  overrides: Partial<CommunityEvent> = {},
): CommunityEvent {
  return {
    id,
    name: id,
    host_organization_id: "org-1",
    starts_at: startsAt,
    ends_at: new Date(Date.parse(startsAt) + 60 * 60 * 1000).toISOString(),
    capacity: 20,
    status: "OPEN",
    publication_status: "PUBLISHED",
    archived_at: null,
    created_at: "2026-08-01T12:00:00.000Z",
    last_published_at: null,
    event_series_id: null,
    ...overrides,
  };
}

function registration(
  id: string,
  participantId: string,
  eventId: string,
  overrides: Partial<CommunityRegistration> = {},
): CommunityRegistration {
  return {
    id,
    participant_id: participantId,
    event_id: eventId,
    registration_status: "REGISTERED",
    registration_outcome: "ACTIVE",
    registered_at: "2026-08-01T12:00:00.000Z",
    cancelled_at: null,
    ...overrides,
  };
}

function attendance(registrationId: string, status: string): CommunityAttendance {
  return { registration_id: registrationId, status, finalized_at: now.toISOString() };
}

describe("Community Touchpoint Slice 1 projection", () => {
  it("projects first, second, tenth, and return milestones without duplicate IDs", () => {
    const events = Array.from({ length: 10 }, (_, index) =>
      event(
        `event-${index + 1}`,
        index === 9
          ? "2025-02-15T12:00:00.000Z"
          : `2025-01-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
      ),
    );
    const registrations = events.map((item, index) =>
      registration(`registration-${index + 1}`, "person-1", item.id),
    );
    const records = registrations.map((item) => attendance(item.id, "ATTENDED"));
    const result = projectCommunityTouchpoints({ registrations, events, attendance: records, now });

    expect(result.map((item) => item.type)).toEqual(
      expect.arrayContaining([
        "FIRST_CLASS",
        "SECOND_CLASS",
        "TENTH_CLASS",
        "FIRST_CLASS_AFTER_ABSENCE",
      ]),
    );
    expect(new Set(result.map((item) => item.id)).size).toBe(result.length);
  });

  it("ignores attendance that has not been finalized", () => {
    const pastEvents = [
      event("past-1", "2026-01-01T12:00:00.000Z"),
      event("past-2", "2026-01-02T12:00:00.000Z"),
      event("past-3", "2026-01-03T12:00:00.000Z"),
    ];
    const registrations = pastEvents.map((item, index) =>
      registration(`unfinalized-${index}`, "person-unfinalized", item.id),
    );
    const records = registrations.map((item, index) => ({
      registration_id: item.id,
      status: "NO_SHOW",
      finalized_at: index === 0 ? now.toISOString() : null,
    }));
    const result = projectCommunityTouchpoints({
      registrations,
      events: pastEvents,
      attendance: records,
      now,
    });
    expect(result.some((item) => item.type === "FIRST_NO_SHOW")).toBe(true);
    expect(result.some((item) => item.type === "REPEATED_NO_SHOW")).toBe(false);
    expect(result.some((item) => item.type === "FIRST_CLASS")).toBe(false);
  });

  it("deduplicates a recurring New Class concept and enforces the seven-day window", () => {
    const seriesEvents = [
      event("series-1", "2026-08-25T12:00:00.000Z", {
        event_series_id: "series-a",
        last_published_at: "2026-08-15T12:00:00.000Z",
      }),
      event("series-2", "2026-09-01T12:00:00.000Z", {
        event_series_id: "series-a",
        last_published_at: "2026-08-15T12:00:00.000Z",
      }),
      event("too-old", "2026-08-26T12:00:00.000Z", {
        last_published_at: "2026-08-11T11:59:59.000Z",
      }),
    ];
    const result = projectCommunityTouchpoints({
      registrations: [],
      events: seriesEvents,
      attendance: [],
      publicationEvents: [
        {
          entity_id: "series-a",
          entity_type: "EVENT_SERIES",
          action: "EVENT_SERIES_PUBLISHED",
          created_at: "2026-08-15T12:00:00.000Z",
        },
      ],
      now,
    });
    expect(result.filter((item) => item.type === "NEW_CLASS")).toHaveLength(1);
    expect(result.find((item) => item.type === "NEW_CLASS")?.id).toBe(
      "touchpoint:NEW_CLASS:series-a",
    );
  });

  it("uses the first publication evidence and does not restart on republish", () => {
    const republished = event("republished", "2026-08-25T12:00:00.000Z", {
      last_published_at: "2026-08-18T12:00:00.000Z",
    });
    const result = projectCommunityTouchpoints({
      registrations: [],
      events: [republished],
      attendance: [],
      publicationEvents: [
        {
          entity_id: "republished",
          entity_type: "EVENT",
          action: "EVENT_PUBLISHED",
          created_at: "2026-08-01T12:00:00.000Z",
        },
        {
          entity_id: "republished",
          entity_type: "EVENT",
          action: "EVENT_PUBLISHED",
          created_at: "2026-08-18T12:00:00.000Z",
        },
      ],
      now,
    });
    expect(result.some((item) => item.type === "NEW_CLASS")).toBe(false);
  });

  it("does not infer New Class from last_published_at without first-publication evidence", () => {
    const eventWithNoAuditEvidence = event("no-audit-evidence", "2026-08-25T12:00:00.000Z", {
      last_published_at: "2026-08-18T12:00:00.000Z",
    });
    const result = projectCommunityTouchpoints({
      registrations: [],
      events: [eventWithNoAuditEvidence],
      attendance: [],
      now,
    });
    expect(result.some((item) => item.type === "NEW_CLASS")).toBe(false);
  });

  it("uses strict low-attendance and full-event boundaries", () => {
    const events = [
      event("at-quarter", "2026-08-20T12:00:00.000Z", { capacity: 4 }),
      event("below-quarter", "2026-08-20T11:59:59.000Z", { capacity: 5 }),
      event("full", "2026-08-21T12:00:00.000Z", { capacity: 1 }),
    ];
    const registrations = [
      registration("r-quarter", "p-1", "at-quarter"),
      registration("r-below", "p-2", "below-quarter"),
      registration("r-full", "p-3", "full"),
    ];
    const result = projectCommunityTouchpoints({ registrations, events, attendance: [], now });
    expect(
      result.some((item) => item.type === "LOW_ATTENDANCE_EVENT" && item.eventId === "at-quarter"),
    ).toBe(false);
    expect(
      result.some(
        (item) => item.type === "LOW_ATTENDANCE_EVENT" && item.eventId === "below-quarter",
      ),
    ).toBe(true);
    expect(result.some((item) => item.type === "FULL_EVENT" && item.eventId === "full")).toBe(true);
  });

  it("projects first and repeated no-show, and resets cancellations after attendance", () => {
    const events = Array.from({ length: 6 }, (_, index) =>
      event(`booked-${index}`, `2026-01-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`),
    );
    const registrations = events.map((item, index) =>
      registration(
        `booking-${index}`,
        "person-2",
        item.id,
        index >= 4 && index < 6
          ? {
              registration_status: "CANCELLED",
              registration_outcome: "PARTICIPANT_CANCELLED",
              cancelled_at: now.toISOString(),
            }
          : {},
      ),
    );
    const records = [
      ...registrations.slice(0, 3).map((item) => attendance(item.id, "NO_SHOW")),
      attendance(registrations[3].id, "ATTENDED"),
    ];
    const result = projectCommunityTouchpoints({ registrations, events, attendance: records, now });
    expect(result.some((item) => item.type === "FIRST_NO_SHOW")).toBe(true);
    expect(result.some((item) => item.type === "REPEATED_NO_SHOW")).toBe(true);
    expect(result.some((item) => item.type === "FREQUENT_CANCELLATION")).toBe(false);
  });

  it("requires exactly three participant cancellations within the most recent six bookings", () => {
    const outsideWindowEvents = Array.from({ length: 3 }, (_, index) =>
      event(`outside-${index}`, `2025-12-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`),
    );
    const insideWindowEvents = Array.from({ length: 6 }, (_, index) =>
      event(`inside-${index}`, `2026-01-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`),
    );
    const events = [...outsideWindowEvents, ...insideWindowEvents];
    const registrations = events.map((item, index) =>
      registration(
        `cancellation-${index}`,
        "person-cancel",
        item.id,
        index < 6
          ? {
              registration_status: "CANCELLED",
              registration_outcome: "PARTICIPANT_CANCELLED",
              cancelled_at: now.toISOString(),
            }
          : {},
      ),
    );
    const result = projectCommunityTouchpoints({ registrations, events, attendance: [], now });
    expect(result.some((item) => item.type === "FREQUENT_CANCELLATION")).toBe(true);

    const onlyOutsideCancellations = events.map((item, index) =>
      registration(
        `outside-only-${index}`,
        "person-cancel-outside",
        item.id,
        index < 3
          ? {
              registration_status: "CANCELLED",
              registration_outcome: "PARTICIPANT_CANCELLED",
              cancelled_at: now.toISOString(),
            }
          : {},
      ),
    );
    const outsideResult = projectCommunityTouchpoints({
      registrations: onlyOutsideCancellations,
      events,
      attendance: [],
      now,
    });
    expect(outsideResult.some((item) => item.type === "FREQUENT_CANCELLATION")).toBe(false);
  });

  it("does not let unfinalized attendance reset the cancellation pattern", () => {
    const events = Array.from({ length: 6 }, (_, index) =>
      event(`reset-${index}`, `2026-02-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`),
    );
    const registrations = events.map((item, index) =>
      registration(
        `reset-booking-${index}`,
        "person-reset",
        item.id,
        index !== 3
          ? {
              registration_status: "CANCELLED",
              registration_outcome: "PARTICIPANT_CANCELLED",
              cancelled_at: now.toISOString(),
            }
          : {},
      ),
    );
    const records = [
      { registration_id: registrations[3].id, status: "ATTENDED", finalized_at: null },
    ];
    const result = projectCommunityTouchpoints({ registrations, events, attendance: records, now });
    expect(result.some((item) => item.type === "FREQUENT_CANCELLATION")).toBe(true);
  });
});
