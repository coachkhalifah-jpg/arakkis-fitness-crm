import "server-only";

import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import {
  ENGAGE_CONTEXT_COPY,
  type EngageCategory,
  type EngageContextSignal,
  type EngageRecommendation,
} from "@/lib/services/engage-recommendations";

export type EngageContextEvent = {
  id: string;
  name: string;
  host_organization_id: string;
  venue_id: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  capacity: number;
  status: string;
  publication_status: string;
  archived_at: string | null;
  registration_deadline: string;
  event_series_id: string | null;
  attendance_processing_state: string;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
  registration_paused_at?: string | null;
};

export type EngageContextVenue = {
  id: string;
  name: string;
  organization_id: string | null;
  active_status: string;
  archived_at: string | null;
};

export type EngageContextOrganization = {
  id: string;
  name: string;
  active_status: string;
};

export type EngageContextRegistration = {
  id: string;
  participant_id: string;
  event_id: string;
  registration_status: string;
  registration_outcome: string;
  registered_at: string;
};

export type EngageContextAttendance = {
  registration_id: string;
  status: string;
  finalized_at: string | null;
};

export type EngageContextPublication = {
  entity_id: string | null;
  entity_type: string;
  action: string;
  created_at: string;
};

export type EngageContextScheduleRule = {
  id: string;
  event_series_id: string;
  weekday: number;
  local_start_time: string;
  local_end_time: string;
  effective_start_date: string;
  effective_end_date: string | null;
  supersedes_rule_id: string | null;
};

export type EngageContextInput = {
  events: EngageContextEvent[];
  venues: EngageContextVenue[];
  organizations: EngageContextOrganization[];
  registrations: EngageContextRegistration[];
  attendance: EngageContextAttendance[];
  publicationEvents: EngageContextPublication[];
  scheduleRules: EngageContextScheduleRule[];
  now?: Date;
  newClassWindowDays?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function addContextual(
  output: Map<string, EngageRecommendation>,
  signal: EngageContextSignal,
  id: string,
  context: { eventId?: string; organizationId?: string; relevantAt: string },
) {
  if (output.has(id)) return;
  const copy = ENGAGE_CONTEXT_COPY[signal];
  output.set(id, { id, source: "CONTEXTUAL", ...copy, ...context });
}

function isPublished(event: EngageContextEvent) {
  return event.publication_status === "PUBLISHED" && event.archived_at === null;
}

function isPublishedOpen(event: EngageContextEvent) {
  return isPublished(event) && event.status === "OPEN";
}

function isUpcomingAvailable(event: EngageContextEvent, now: Date) {
  return (
    isPublishedOpen(event) &&
    Date.parse(event.starts_at) > now.getTime() &&
    Date.parse(event.registration_deadline) >= now.getTime() &&
    (!event.registration_opens_at || Date.parse(event.registration_opens_at) <= now.getTime()) &&
    (!event.registration_closes_at || Date.parse(event.registration_closes_at) > now.getTime()) &&
    !event.registration_paused_at
  );
}

function isFinalizedAttendance(record: EngageContextAttendance | undefined) {
  return Boolean(record?.finalized_at);
}

function firstPublicationForEvent(
  event: EngageContextEvent,
  publicationEvents: EngageContextPublication[],
) {
  const candidates = publicationEvents.filter(
    (publication) =>
      publication.action === "EVENT_PUBLISHED" &&
      publication.entity_type === "EVENT" &&
      publication.entity_id === event.id,
  );
  return candidates.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0]
    ?.created_at;
}

function firstPublicationForSeries(
  seriesId: string,
  publicationEvents: EngageContextPublication[],
) {
  return publicationEvents
    .filter(
      (publication) =>
        publication.action === "EVENT_SERIES_PUBLISHED" &&
        publication.entity_type === "EVENT_SERIES" &&
        publication.entity_id === seriesId,
    )
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0]?.created_at;
}

function projectNewClasses(
  output: Map<string, EngageRecommendation>,
  input: EngageContextInput,
  now: Date,
) {
  const windowDays = input.newClassWindowDays ?? 7;
  const cutoff = now.getTime() - windowDays * DAY_MS;
  const eligible = input.events.filter(isPublishedOpen);
  const emitted = new Set<string>();
  for (const event of eligible.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))) {
    const seriesKey = event.event_series_id;
    const publishedAt = seriesKey
      ? (firstPublicationForSeries(seriesKey, input.publicationEvents) ??
        firstPublicationForEvent(event, input.publicationEvents))
      : firstPublicationForEvent(event, input.publicationEvents);
    if (!publishedAt || Date.parse(publishedAt) < cutoff || Date.parse(publishedAt) > now.getTime())
      continue;
    const key = seriesKey ?? event.id;
    if (emitted.has(key)) continue;
    emitted.add(key);
    addContextual(
      output,
      "NEW_CLASS",
      `engage:contextual:new-class:${seriesKey ? "series" : "event"}:${key}`,
      {
        eventId: event.id,
        organizationId: event.host_organization_id,
        relevantAt: publishedAt,
      },
    );
  }
}

function projectNewVenues(
  output: Map<string, EngageRecommendation>,
  input: EngageContextInput,
  now: Date,
) {
  const activeVenues = new Set(
    input.venues
      .filter((venue) => venue.active_status === "ACTIVE" && venue.archived_at === null)
      .map((venue) => venue.id),
  );
  const publishedByVenue = new Map<string, EngageContextEvent[]>();
  for (const event of input.events) {
    if (!activeVenues.has(event.venue_id) || !isPublishedOpen(event)) continue;
    if (Date.parse(event.starts_at) <= now.getTime()) continue;
    const list = publishedByVenue.get(event.venue_id) ?? [];
    list.push(event);
    publishedByVenue.set(event.venue_id, list);
  }
  for (const [venueId, events] of publishedByVenue) {
    const first = [...events].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];
    if (!first) continue;
    addContextual(output, "NEW_VENUE", `engage:contextual:new-venue:venue:${venueId}`, {
      eventId: first.id,
      organizationId: first.host_organization_id,
      relevantAt: first.starts_at,
    });
  }
}

function projectUpcomingNewcomers(
  output: Map<string, EngageRecommendation>,
  input: EngageContextInput,
  now: Date,
) {
  const eventsById = new Map(input.events.map((event) => [event.id, event]));
  const attendanceByRegistration = new Map(
    input.attendance.map((record) => [record.registration_id, record]),
  );
  const hasPriorAttendance = new Set<string>();
  for (const registration of input.registrations) {
    const event = eventsById.get(registration.event_id);
    const attendance = attendanceByRegistration.get(registration.id);
    if (event && attendance?.status === "ATTENDED" && isFinalizedAttendance(attendance)) {
      hasPriorAttendance.add(`${registration.participant_id}:${event.id}`);
    }
  }
  for (const event of input.events.filter((candidate) => isUpcomingAvailable(candidate, now))) {
    const newcomers = input.registrations.filter(
      (registration) =>
        registration.event_id === event.id &&
        registration.registration_status === "REGISTERED" &&
        registration.registration_outcome === "ACTIVE" &&
        !input.registrations.some(
          (prior) =>
            prior.participant_id === registration.participant_id &&
            prior.event_id !== event.id &&
            eventsById.has(prior.event_id) &&
            Date.parse(eventsById.get(prior.event_id)!.starts_at) < Date.parse(event.starts_at) &&
            hasPriorAttendance.has(`${prior.participant_id}:${prior.event_id}`),
        ),
    );
    if (newcomers.length < 2) continue;
    addContextual(output, "UPCOMING_NEWCOMERS", `engage:contextual:newcomers:event:${event.id}`, {
      eventId: event.id,
      organizationId: event.host_organization_id,
      relevantAt: event.starts_at,
    });
  }
}

function projectFullEvents(
  output: Map<string, EngageRecommendation>,
  input: EngageContextInput,
  now: Date,
) {
  for (const event of input.events.filter((candidate) => isUpcomingAvailable(candidate, now))) {
    const activeCount = input.registrations.filter(
      (registration) =>
        registration.event_id === event.id &&
        registration.registration_status === "REGISTERED" &&
        registration.registration_outcome === "ACTIVE",
    ).length;
    if (activeCount >= event.capacity) {
      addContextual(output, "FULL_EVENT", `engage:contextual:full-event:event:${event.id}`, {
        eventId: event.id,
        organizationId: event.host_organization_id,
        relevantAt: event.starts_at,
      });
    }
  }
}

function projectCompletedEvents(
  output: Map<string, EngageRecommendation>,
  input: EngageContextInput,
  now: Date,
) {
  const latestByOrganization = new Map<string, EngageContextEvent>();
  for (const event of input.events) {
    if (
      !isPublished(event) ||
      event.status !== "COMPLETED" ||
      event.attendance_processing_state !== "FINALIZED" ||
      Date.parse(event.ends_at) > now.getTime()
    )
      continue;
    const current = latestByOrganization.get(event.host_organization_id);
    if (!current || Date.parse(event.ends_at) > Date.parse(current.ends_at))
      latestByOrganization.set(event.host_organization_id, event);
  }
  for (const event of latestByOrganization.values()) {
    addContextual(
      output,
      "COMPLETED_EVENT",
      `engage:contextual:completed-event:event:${event.id}`,
      {
        eventId: event.id,
        organizationId: event.host_organization_id,
        relevantAt: event.ends_at,
      },
    );
  }
}

function localCalendarDate(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function localIsoWeekday(value: string, timezone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(new Date(value));
  return ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[
    weekday
  ];
}

function activeRulesForEvent(rules: EngageContextScheduleRule[], event: EngageContextEvent) {
  const localDate = localCalendarDate(event.starts_at, event.timezone);
  const weekday = localIsoWeekday(event.starts_at, event.timezone);
  const candidates = rules.filter(
    (rule) =>
      rule.event_series_id === event.event_series_id &&
      rule.weekday === weekday &&
      rule.effective_start_date <= localDate &&
      (!rule.effective_end_date || rule.effective_end_date >= localDate),
  );
  const supersededIds = new Set(candidates.map((rule) => rule.supersedes_rule_id).filter(Boolean));
  return candidates.filter((rule) => !supersededIds.has(rule.id));
}

function projectScheduleDifferences(
  output: Map<string, EngageRecommendation>,
  input: EngageContextInput,
  now: Date,
) {
  const eventsBySeries = new Map<string, EngageContextEvent[]>();
  for (const event of input.events) {
    if (event.event_series_id && isUpcomingAvailable(event, now)) {
      const list = eventsBySeries.get(event.event_series_id) ?? [];
      list.push(event);
      eventsBySeries.set(event.event_series_id, list);
    }
  }
  for (const [seriesId, events] of eventsBySeries) {
    const activeRules = events.flatMap((event) => activeRulesForEvent(input.scheduleRules, event));
    const combinations = new Set(
      activeRules.map((rule) => `${rule.weekday}:${rule.local_start_time}:${rule.local_end_time}`),
    );
    if (combinations.size < 2) continue;
    const firstEvent = [...events].sort(
      (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at),
    )[0];
    addContextual(
      output,
      "SCHEDULE_DIFFERENCE",
      `engage:contextual:schedule-difference:series:${seriesId}`,
      {
        eventId: firstEvent.id,
        organizationId: firstEvent.host_organization_id,
        relevantAt: firstEvent.starts_at,
      },
    );
  }
}

/** Pure Slice 2 projection. It only returns ephemeral recommendations. */
export function projectEngageContext(input: EngageContextInput): EngageRecommendation[] {
  const now = input.now ?? new Date();
  const output = new Map<string, EngageRecommendation>();
  const activeOrganizations = new Set(
    input.organizations
      .filter((organization) => organization.active_status === "ACTIVE")
      .map((organization) => organization.id),
  );
  const activeVenues = new Map(
    input.venues
      .filter((venue) => venue.active_status === "ACTIVE" && venue.archived_at === null)
      .map((venue) => [venue.id, venue]),
  );
  const authorizedEvents = input.events.filter((event) => {
    if (!activeOrganizations.has(event.host_organization_id)) return false;
    const venue = activeVenues.get(event.venue_id);
    return Boolean(
      venue &&
      (venue.organization_id === null || venue.organization_id === event.host_organization_id),
    );
  });
  const scopedInput = { ...input, events: authorizedEvents };
  projectNewClasses(output, scopedInput, now);
  projectNewVenues(output, scopedInput, now);
  projectUpcomingNewcomers(output, scopedInput, now);
  projectFullEvents(output, scopedInput, now);
  projectCompletedEvents(output, scopedInput, now);
  projectScheduleDifferences(output, scopedInput, now);
  return [...output.values()].sort(
    (a, b) =>
      Date.parse(a.relevantAt ?? "") - Date.parse(b.relevantAt ?? "") || a.id.localeCompare(b.id),
  );
}

/** Loads only authorized context after the canonical System Admin boundary. */
export async function getEngageContextRecommendations(now = new Date()) {
  await requireSystemAdmin("/admin/community?mode=group");
  const db = await createClient();
  const [
    eventsResult,
    venuesResult,
    organizationsResult,
    registrationsResult,
    attendanceResult,
    publicationResult,
    rulesResult,
  ] = await Promise.all([
    db
      .from("events")
      .select(
        "id,name,host_organization_id,venue_id,starts_at,ends_at,timezone,capacity,status,publication_status,archived_at,registration_deadline,event_series_id,attendance_processing_state,registration_opens_at,registration_closes_at,registration_paused_at",
      ),
    db.from("venues").select("id,name,organization_id,active_status,archived_at"),
    db.from("organizations").select("id,name,active_status"),
    db
      .from("registrations")
      .select("id,participant_id,event_id,registration_status,registration_outcome,registered_at"),
    db.from("attendance").select("registration_id,status,finalized_at"),
    db
      .from("audit_events")
      .select("entity_id,entity_type,action,created_at")
      .in("action", ["EVENT_PUBLISHED", "EVENT_SERIES_PUBLISHED"]),
    db
      .from("event_series_schedule_rules")
      .select(
        "id,event_series_id,weekday,local_start_time,local_end_time,effective_start_date,effective_end_date,supersedes_rule_id",
      ),
  ]);
  for (const result of [
    eventsResult,
    venuesResult,
    organizationsResult,
    registrationsResult,
    attendanceResult,
    publicationResult,
    rulesResult,
  ]) {
    if (result.error) throw result.error;
  }
  return projectEngageContext({
    events: (eventsResult.data ?? []) as EngageContextEvent[],
    venues: (venuesResult.data ?? []) as EngageContextVenue[],
    organizations: (organizationsResult.data ?? []) as EngageContextOrganization[],
    registrations: (registrationsResult.data ?? []) as EngageContextRegistration[],
    attendance: (attendanceResult.data ?? []) as EngageContextAttendance[],
    publicationEvents: (publicationResult.data ?? []) as EngageContextPublication[],
    scheduleRules: (rulesResult.data ?? []) as EngageContextScheduleRule[],
    now,
  });
}
