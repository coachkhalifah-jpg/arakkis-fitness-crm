import { describe, expect, it } from "vitest";
import { projectEngageContext, type EngageContextInput } from "@/lib/services/engage-context";

const now = new Date("2026-08-20T12:00:00.000Z");
const org = { id: "org-1", name: "Northstar Movement", active_status: "ACTIVE" };
const venue = {
  id: "venue-1",
  name: "Studio",
  organization_id: "org-1",
  active_status: "ACTIVE",
  archived_at: null,
};
const baseEvent = {
  id: "event-1",
  name: "Open Studio",
  host_organization_id: "org-1",
  venue_id: "venue-1",
  starts_at: "2026-08-25T18:00:00.000Z",
  ends_at: "2026-08-25T19:00:00.000Z",
  capacity: 2,
  timezone: "America/New_York",
  status: "OPEN",
  publication_status: "PUBLISHED",
  archived_at: null,
  registration_deadline: "2026-08-25T17:00:00.000Z",
  event_series_id: null,
  attendance_processing_state: "NOT_STARTED",
};

function input(overrides: Partial<EngageContextInput> = {}): EngageContextInput {
  return {
    events: [baseEvent],
    venues: [venue],
    organizations: [org],
    registrations: [],
    attendance: [],
    publicationEvents: [
      {
        entity_id: "event-1",
        entity_type: "EVENT",
        action: "EVENT_PUBLISHED",
        created_at: "2026-08-19T12:00:00.000Z",
      },
    ],
    scheduleRules: [],
    now,
    ...overrides,
  };
}

describe("Engage context adapter", () => {
  it("supports the six categories through contextual signals", () => {
    const completed = {
      ...baseEvent,
      id: "event-completed",
      status: "COMPLETED",
      starts_at: "2026-08-18T18:00:00.000Z",
      ends_at: "2026-08-18T19:00:00.000Z",
      attendance_processing_state: "FINALIZED",
    };
    const seriesEvent = {
      ...baseEvent,
      id: "event-series",
      event_series_id: "series-1",
      starts_at: "2026-08-26T18:00:00.000Z",
      ends_at: "2026-08-26T19:00:00.000Z",
    };
    const seriesEventTwo = {
      ...baseEvent,
      id: "event-series-two",
      event_series_id: "series-1",
      starts_at: "2026-08-25T18:00:00.000Z",
      ends_at: "2026-08-25T19:00:00.000Z",
    };
    const registrations = [
      {
        id: "r1",
        participant_id: "p1",
        event_id: "event-1",
        registration_status: "REGISTERED",
        registration_outcome: "ACTIVE",
        registered_at: now.toISOString(),
      },
      {
        id: "r2",
        participant_id: "p2",
        event_id: "event-1",
        registration_status: "REGISTERED",
        registration_outcome: "ACTIVE",
        registered_at: now.toISOString(),
      },
    ];
    const records = projectEngageContext(
      input({
        events: [baseEvent, completed, seriesEvent, seriesEventTwo],
        registrations,
        scheduleRules: [
          {
            id: "rule-1",
            event_series_id: "series-1",
            weekday: 2,
            local_start_time: "18:00",
            local_end_time: "19:00",
            effective_start_date: "2026-08-01",
            effective_end_date: null,
            supersedes_rule_id: null,
          },
          {
            id: "rule-2",
            event_series_id: "series-1",
            weekday: 3,
            local_start_time: "18:00",
            local_end_time: "19:00",
            effective_start_date: "2026-08-01",
            effective_end_date: null,
            supersedes_rule_id: null,
          },
        ],
        publicationEvents: [
          {
            entity_id: "event-1",
            entity_type: "EVENT",
            action: "EVENT_PUBLISHED",
            created_at: "2026-08-19T12:00:00.000Z",
          },
          {
            entity_id: "event-series",
            entity_type: "EVENT",
            action: "EVENT_PUBLISHED",
            created_at: "2026-08-19T12:00:00.000Z",
          },
          {
            entity_id: "series-1",
            entity_type: "EVENT_SERIES",
            action: "EVENT_SERIES_PUBLISHED",
            created_at: "2026-08-19T12:00:00.000Z",
          },
        ],
      }),
    );
    expect(new Set(records.map((record) => record.category))).toEqual(
      new Set(["LOGISTICS", "BEFORE_CLASS", "AFTER_CLASS", "POLLS"]),
    );
    expect(
      records.some((record) => record.title === "A Full Room Is Worth Acknowledging"),
    ).toBeTruthy();
    expect(records.some((record) => record.title === "Welcome a Few New Faces")).toBeTruthy();
    expect(records.every((record) => record.source === "CONTEXTUAL")).toBe(true);
  });

  it("requires finalized attendance for newcomer history and bounds completed output", () => {
    const prior = {
      ...baseEvent,
      id: "prior",
      starts_at: "2026-08-10T18:00:00.000Z",
      ends_at: "2026-08-10T19:00:00.000Z",
      attendance_processing_state: "FINALIZED",
    };
    const registrations = [
      {
        id: "prior-r",
        participant_id: "p1",
        event_id: "prior",
        registration_status: "REGISTERED",
        registration_outcome: "ACTIVE",
        registered_at: now.toISOString(),
      },
      {
        id: "r1",
        participant_id: "p1",
        event_id: "event-1",
        registration_status: "REGISTERED",
        registration_outcome: "ACTIVE",
        registered_at: now.toISOString(),
      },
      {
        id: "r2",
        participant_id: "p2",
        event_id: "event-1",
        registration_status: "REGISTERED",
        registration_outcome: "ACTIVE",
        registered_at: now.toISOString(),
      },
    ];
    const records = projectEngageContext(
      input({
        events: [prior, baseEvent],
        registrations,
        attendance: [{ registration_id: "prior-r", status: "ATTENDED", finalized_at: null }],
      }),
    );
    expect(
      records.some((record) => record.id === "engage:contextual:newcomers:event:event-1"),
    ).toBe(true);
    const finalized = projectEngageContext(
      input({
        events: [prior, baseEvent],
        registrations,
        attendance: [
          {
            registration_id: "prior-r",
            status: "ATTENDED",
            finalized_at: "2026-08-10T20:00:00.000Z",
          },
        ],
      }),
    );
    expect(
      finalized.some((record) => record.id === "engage:contextual:newcomers:event:event-1"),
    ).toBe(false);
  });

  it("uses stable domain IDs, deduplicates recurring new class, and never returns persistence fields", () => {
    const first = { ...baseEvent, id: "series-a", event_series_id: "series-1" };
    const second = {
      ...baseEvent,
      id: "series-b",
      event_series_id: "series-1",
      starts_at: "2026-09-01T18:00:00.000Z",
      ends_at: "2026-09-01T19:00:00.000Z",
    };
    const data = input({
      events: [first, second],
      publicationEvents: [
        {
          entity_id: "series-1",
          entity_type: "EVENT_SERIES",
          action: "EVENT_SERIES_PUBLISHED",
          created_at: "2026-08-19T12:00:00.000Z",
        },
      ],
    });
    const a = projectEngageContext(data);
    const b = projectEngageContext(data);
    expect(a).toEqual(b);
    expect(a.filter((record) => record.id.includes("new-class:series:series-1"))).toHaveLength(1);
    expect(
      a.every(
        (record) => !("dueAt" in record) && !("status" in record) && !("assignedAdminId" in record),
      ),
    ).toBe(true);
  });

  it("excludes inactive organization context and unavailable events", () => {
    const unavailable = {
      ...baseEvent,
      id: "unavailable",
      registration_paused_at: now.toISOString(),
    };
    expect(
      projectEngageContext(
        input({ events: [unavailable], organizations: [{ ...org, active_status: "ARCHIVED" }] }),
      ),
    ).toEqual([]);
  });

  it("uses the immutable first publication and a seven-day New Class window", () => {
    const exactlyWithin = projectEngageContext(
      input({
        publicationEvents: [
          {
            entity_id: "event-1",
            entity_type: "EVENT",
            action: "EVENT_PUBLISHED",
            created_at: "2026-08-13T12:00:00.000Z",
          },
        ],
      }),
    );
    expect(
      exactlyWithin.some((record) => record.id === "engage:contextual:new-class:event:event-1"),
    ).toBe(true);

    const outsideWindow = projectEngageContext(
      input({
        publicationEvents: [
          {
            entity_id: "event-1",
            entity_type: "EVENT",
            action: "EVENT_PUBLISHED",
            created_at: "2026-08-12T11:59:59.000Z",
          },
          {
            entity_id: "event-1",
            entity_type: "EVENT",
            action: "EVENT_PUBLISHED",
            created_at: "2026-08-19T12:00:00.000Z",
          },
        ],
      }),
    );
    expect(
      outsideWindow.some((record) => record.id === "engage:contextual:new-class:event:event-1"),
    ).toBe(false);
  });

  it("does not restart New Class after republishing and keeps recurring output at series level", () => {
    const recurring = [
      { ...baseEvent, id: "series-a", event_series_id: "series-1" },
      {
        ...baseEvent,
        id: "series-b",
        event_series_id: "series-1",
        starts_at: "2026-08-26T18:00:00.000Z",
        ends_at: "2026-08-26T19:00:00.000Z",
      },
    ];
    const records = projectEngageContext(
      input({
        events: recurring,
        publicationEvents: [
          {
            entity_id: "series-1",
            entity_type: "EVENT_SERIES",
            action: "EVENT_SERIES_PUBLISHED",
            created_at: "2026-08-12T12:00:00.000Z",
          },
          {
            entity_id: "series-1",
            entity_type: "EVENT_SERIES",
            action: "EVENT_SERIES_PUBLISHED",
            created_at: "2026-08-19T12:00:00.000Z",
          },
        ],
      }),
    );
    expect(
      records.filter((record) => record.id.includes("new-class:series:series-1")),
    ).toHaveLength(0);
  });

  it("describes the first future gathering and accepts organization or public venues only", () => {
    const publicVenue = {
      id: "venue-public",
      name: "Public Studio",
      organization_id: null,
      active_status: "ACTIVE",
      archived_at: null,
    };
    const unrelatedVenue = {
      id: "venue-other",
      name: "Other Studio",
      organization_id: "org-2",
      active_status: "ACTIVE",
      archived_at: null,
    };
    const archivedVenue = {
      id: "venue-archived",
      name: "Archived Studio",
      organization_id: null,
      active_status: "ACTIVE",
      archived_at: "2026-08-01T00:00:00.000Z",
    };
    const futureAtOrganization = {
      ...baseEvent,
      id: "organization-event",
      starts_at: "2026-08-26T18:00:00.000Z",
      ends_at: "2026-08-26T19:00:00.000Z",
    };
    const futureAtPublic = {
      ...baseEvent,
      id: "public-event",
      venue_id: publicVenue.id,
      starts_at: "2026-08-27T18:00:00.000Z",
      ends_at: "2026-08-27T19:00:00.000Z",
    };
    const futureAtUnrelated = {
      ...baseEvent,
      id: "unrelated-event",
      venue_id: unrelatedVenue.id,
      starts_at: "2026-08-28T18:00:00.000Z",
      ends_at: "2026-08-28T19:00:00.000Z",
    };
    const futureAtArchived = {
      ...baseEvent,
      id: "archived-event",
      venue_id: archivedVenue.id,
      starts_at: "2026-08-29T18:00:00.000Z",
      ends_at: "2026-08-29T19:00:00.000Z",
    };
    const records = projectEngageContext(
      input({
        events: [futureAtOrganization, futureAtPublic, futureAtUnrelated, futureAtArchived],
        venues: [venue, publicVenue, unrelatedVenue, archivedVenue],
        organizations: [org, { id: "org-2", name: "Other Organization", active_status: "ACTIVE" }],
      }),
    );
    const gathering = records.find(
      (record) => record.id === "engage:contextual:new-venue:venue:venue-public",
    );
    expect(gathering?.title).toBe("Welcome to This Location");
    expect(
      records.some((record) => record.id === "engage:contextual:new-venue:venue:venue-1"),
    ).toBe(true);
    expect(records.some((record) => record.eventId === "unrelated-event")).toBe(false);
    expect(records.some((record) => record.eventId === "archived-event")).toBe(false);
  });

  it("uses Event-local dates and ISO weekdays for effective schedule rules", () => {
    const mondayLateUtc = {
      ...baseEvent,
      id: "series-monday",
      event_series_id: "series-local",
      starts_at: "2026-08-25T02:30:00.000Z",
      ends_at: "2026-08-25T03:30:00.000Z",
    };
    const tuesdayLateUtc = {
      ...baseEvent,
      id: "series-tuesday",
      event_series_id: "series-local",
      starts_at: "2026-08-26T02:30:00.000Z",
      ends_at: "2026-08-26T03:30:00.000Z",
    };
    const rules = [
      {
        id: "rule-monday",
        event_series_id: "series-local",
        weekday: 1,
        local_start_time: "22:30",
        local_end_time: "23:30",
        effective_start_date: "2026-08-25",
        effective_end_date: null,
        supersedes_rule_id: null,
      },
      {
        id: "rule-tuesday",
        event_series_id: "series-local",
        weekday: 2,
        local_start_time: "22:30",
        local_end_time: "23:30",
        effective_start_date: "2026-08-25",
        effective_end_date: "2026-08-24",
        supersedes_rule_id: null,
      },
    ];
    const beforeStart = projectEngageContext(
      input({ events: [mondayLateUtc, tuesdayLateUtc], scheduleRules: rules }),
    );
    expect(
      beforeStart.some(
        (record) => record.id === "engage:contextual:schedule-difference:series:series-local",
      ),
    ).toBe(false);

    const daylightSaving = {
      ...baseEvent,
      id: "series-dst",
      event_series_id: "series-dst",
      starts_at: "2026-11-01T14:00:00.000Z",
      ends_at: "2026-11-01T15:00:00.000Z",
    };
    const nextLocalDay = {
      ...baseEvent,
      id: "series-dst-next",
      event_series_id: "series-dst",
      starts_at: "2026-11-02T14:00:00.000Z",
      ends_at: "2026-11-02T15:00:00.000Z",
    };
    const dstRecords = projectEngageContext(
      input({
        events: [daylightSaving, nextLocalDay],
        scheduleRules: [
          {
            id: "rule-sunday",
            event_series_id: "series-dst",
            weekday: 7,
            local_start_time: "09:00",
            local_end_time: "10:00",
            effective_start_date: "2026-11-01",
            effective_end_date: null,
            supersedes_rule_id: null,
          },
          {
            id: "rule-monday",
            event_series_id: "series-dst",
            weekday: 1,
            local_start_time: "09:00",
            local_end_time: "10:00",
            effective_start_date: "2026-11-01",
            effective_end_date: null,
            supersedes_rule_id: null,
          },
        ],
      }),
    );
    expect(
      dstRecords.some(
        (record) => record.id === "engage:contextual:schedule-difference:series:series-dst",
      ),
    ).toBe(true);
  });
});
