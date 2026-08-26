import "server-only";

import { requireSystemAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";

export type TouchpointCategory =
  "BEGINNING" | "CONSISTENCY" | "ABSENCE" | "RETURN" | "MILESTONE" | "OPERATIONAL";

export type CommunityTouchpoint = {
  id: string;
  type: string;
  category: TouchpointCategory;
  participantId?: string;
  eventId?: string;
  organizationId?: string;
  shortReason: string;
  suggestedAction: string;
  relevantAt: string;
  status?: "OPEN" | "COMPLETED" | "DISMISSED" | "SNOOZED";
  dueAt?: string;
  cooldownUntil?: string;
};

export type CommunityRegistration = {
  id: string;
  participant_id: string;
  event_id: string;
  registration_status: string;
  registration_outcome: string;
  registered_at: string;
  cancelled_at: string | null;
};

export type CommunityEvent = {
  id: string;
  name: string;
  host_organization_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  status: string;
  publication_status: string;
  archived_at: string | null;
  created_at: string;
  last_published_at: string | null;
  event_series_id: string | null;
};

export type CommunityAttendance = {
  registration_id: string;
  status: string;
  finalized_at: string | null;
};

export type CommunityPublicationEvent = {
  entity_id: string | null;
  entity_type: string;
  action: string;
  created_at: string;
};

export type CommunityTouchpointInput = {
  registrations: CommunityRegistration[];
  events: CommunityEvent[];
  attendance: CommunityAttendance[];
  publicationEvents?: CommunityPublicationEvent[];
  now?: Date;
};

const RETENTION_COOLDOWN_DAYS = 14;
const NEW_CLASS_WINDOW_DAYS = 7;
const ABSENCE_DAYS = 30;

function stableId(type: string, key: string) {
  return `touchpoint:${type}:${key}`;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function isActiveRegistration(registration: CommunityRegistration) {
  return (
    registration.registration_status === "REGISTERED" &&
    registration.registration_outcome === "ACTIVE"
  );
}

function isPublishedEvent(event: CommunityEvent) {
  return (
    event.archived_at === null &&
    event.status === "OPEN" &&
    event.publication_status === "PUBLISHED"
  );
}

function add(output: Map<string, CommunityTouchpoint>, touchpoint: CommunityTouchpoint) {
  if (!output.has(touchpoint.id)) output.set(touchpoint.id, touchpoint);
}

/**
 * Computes the V1 Community Touchpoint projection from authoritative rows.
 * It is intentionally pure so eligibility can be boundary-tested without a
 * database, and it never writes a follow-up task or reminder.
 */
export function projectCommunityTouchpoints({
  registrations,
  events,
  attendance,
  publicationEvents = [],
  now = new Date(),
}: CommunityTouchpointInput): CommunityTouchpoint[] {
  const output = new Map<string, CommunityTouchpoint>();
  const eventById = new Map(events.map((event) => [event.id, event]));
  const attendanceByRegistration = new Map(
    attendance.map((record) => [record.registration_id, record]),
  );
  const activeRegistrationsByEvent = new Map<string, number>();

  for (const registration of registrations) {
    if (isActiveRegistration(registration)) {
      activeRegistrationsByEvent.set(
        registration.event_id,
        (activeRegistrationsByEvent.get(registration.event_id) ?? 0) + 1,
      );
    }
  }

  const byParticipant = new Map<string, CommunityRegistration[]>();
  for (const registration of registrations) {
    const list = byParticipant.get(registration.participant_id) ?? [];
    list.push(registration);
    byParticipant.set(registration.participant_id, list);
  }

  for (const participantRegistrations of byParticipant.values()) {
    const chronological = [...participantRegistrations].sort((a, b) => {
      const aEvent = eventById.get(a.event_id);
      const bEvent = eventById.get(b.event_id);
      return (
        Date.parse(aEvent?.starts_at ?? a.registered_at) -
        Date.parse(bEvent?.starts_at ?? b.registered_at)
      );
    });
    const finalizedAttendance = (registration: CommunityRegistration) => {
      const record = attendanceByRegistration.get(registration.id);
      return record?.finalized_at !== null && record?.finalized_at !== undefined;
    };
    const attended = chronological.filter(
      (registration) =>
        finalizedAttendance(registration) &&
        attendanceByRegistration.get(registration.id)?.status === "ATTENDED",
    );
    const participantId = participantRegistrations[0]?.participant_id;

    if (attended[0]) {
      const firstEvent = eventById.get(attended[0].event_id);
      if (firstEvent) {
        add(output, {
          id: stableId("FIRST_CLASS", participantId),
          type: "FIRST_CLASS",
          category: "BEGINNING",
          participantId,
          eventId: firstEvent.id,
          organizationId: firstEvent.host_organization_id,
          shortReason: "First Class",
          suggestedAction: "Celebrate",
          relevantAt: firstEvent.starts_at,
          status: "OPEN",
          dueAt: firstEvent.ends_at,
        });
      }
    }

    for (const [index, registration] of attended.entries()) {
      const event = eventById.get(registration.event_id);
      if (!event) continue;
      if (index === 1 || index === 9) {
        const type = index === 1 ? "SECOND_CLASS" : "TENTH_CLASS";
        add(output, {
          id: stableId(type, participantId),
          type,
          category: "CONSISTENCY",
          participantId,
          eventId: event.id,
          organizationId: event.host_organization_id,
          shortReason: index === 1 ? "Second Class" : "10th Class",
          suggestedAction: "Celebrate",
          relevantAt: event.starts_at,
          status: "OPEN",
          dueAt: event.ends_at,
        });
      }
      const previous = attended[index - 1];
      const previousEvent = previous ? eventById.get(previous.event_id) : undefined;
      if (
        previousEvent &&
        Date.parse(event.starts_at) - Date.parse(previousEvent.starts_at) >=
          ABSENCE_DAYS * 24 * 60 * 60 * 1000
      ) {
        add(output, {
          id: stableId("FIRST_CLASS_AFTER_ABSENCE", participantId),
          type: "FIRST_CLASS_AFTER_ABSENCE",
          category: "RETURN",
          participantId,
          eventId: event.id,
          organizationId: event.host_organization_id,
          shortReason: "First Class After Absence",
          suggestedAction: "Celebrate",
          relevantAt: event.starts_at,
          status: "OPEN",
          dueAt: event.ends_at,
        });
      }
    }

    const noShows = chronological.filter(
      (registration) =>
        finalizedAttendance(registration) &&
        attendanceByRegistration.get(registration.id)?.status === "NO_SHOW",
    );
    if (noShows[0]) {
      const event = eventById.get(noShows[0].event_id);
      if (event) {
        add(output, {
          id: stableId("FIRST_NO_SHOW", participantId),
          type: "FIRST_NO_SHOW",
          category: "ABSENCE",
          participantId,
          eventId: event.id,
          organizationId: event.host_organization_id,
          shortReason: "First No-Show",
          suggestedAction: "Touch Base",
          relevantAt: event.starts_at,
          status: "OPEN",
          dueAt: event.ends_at,
        });
      }
    }

    const recent = chronological.slice(-6);
    const recentNoShows = recent.filter(
      (registration) =>
        finalizedAttendance(registration) &&
        attendanceByRegistration.get(registration.id)?.status === "NO_SHOW",
    );
    if (recentNoShows.length >= 3) {
      const event = eventById.get(recentNoShows[recentNoShows.length - 1].event_id);
      if (event) {
        add(output, {
          id: stableId("REPEATED_NO_SHOW", participantId),
          type: "REPEATED_NO_SHOW",
          category: "ABSENCE",
          participantId,
          eventId: event.id,
          organizationId: event.host_organization_id,
          shortReason: "Repeated No-Show",
          suggestedAction: "Touch Base",
          relevantAt: event.starts_at,
          status: "OPEN",
          dueAt: event.ends_at,
        });
      }
    }

    const lastAttendedIndex = recent.reduce(
      (last, registration, index) =>
        finalizedAttendance(registration) &&
        attendanceByRegistration.get(registration.id)?.status === "ATTENDED"
          ? index
          : last,
      -1,
    );
    const cancellationsSinceAttendance = recent
      .slice(lastAttendedIndex + 1)
      .filter(
        (registration) =>
          registration.registration_status === "CANCELLED" &&
          registration.registration_outcome === "PARTICIPANT_CANCELLED",
      );
    if (cancellationsSinceAttendance.length >= 3) {
      const event = eventById.get(cancellationsSinceAttendance.at(-1)!.event_id);
      if (event) {
        add(output, {
          id: stableId("FREQUENT_CANCELLATION", participantId),
          type: "FREQUENT_CANCELLATION",
          category: "RETURN",
          participantId,
          eventId: event.id,
          organizationId: event.host_organization_id,
          shortReason: "Frequent Cancellation",
          suggestedAction: "Touch Base",
          relevantAt: event.starts_at,
          status: "OPEN",
          dueAt: event.ends_at,
          cooldownUntil: addDays(now, RETENTION_COOLDOWN_DAYS),
        });
      }
    }
  }

  const newClassCutoff = new Date(now.getTime() - NEW_CLASS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const emittedClassKeys = new Set<string>();
  const firstPublicationAt = (event: CommunityEvent) => {
    const candidates = publicationEvents.filter(
      (publication) =>
        publication.action === "EVENT_PUBLISHED" &&
        publication.entity_type === "EVENT" &&
        publication.entity_id === event.id,
    );
    if (event.event_series_id) {
      candidates.push(
        ...publicationEvents.filter(
          (publication) =>
            publication.action === "EVENT_SERIES_PUBLISHED" &&
            publication.entity_type === "EVENT_SERIES" &&
            publication.entity_id === event.event_series_id,
        ),
      );
    }
    return candidates.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0]
      ?.created_at;
  };
  for (const event of events) {
    if (!isPublishedEvent(event)) continue;
    const publishedAt = firstPublicationAt(event);
    if (!publishedAt) continue;
    const publishedTime = Date.parse(publishedAt);
    if (publishedTime < newClassCutoff.getTime() || publishedTime > now.getTime()) continue;
    const classKey = event.event_series_id ?? event.id;
    if (emittedClassKeys.has(classKey)) continue;
    emittedClassKeys.add(classKey);
    add(output, {
      id: stableId("NEW_CLASS", classKey),
      type: "NEW_CLASS",
      category: "BEGINNING",
      eventId: event.id,
      organizationId: event.host_organization_id,
      shortReason: "New Class",
      suggestedAction: "Celebrate",
      relevantAt: publishedAt,
      status: "OPEN",
      dueAt: publishedAt,
    });
  }

  for (const event of events) {
    if (!isPublishedEvent(event) || Date.parse(event.starts_at) <= now.getTime()) continue;
    const activeCount = activeRegistrationsByEvent.get(event.id) ?? 0;
    if (activeCount >= event.capacity) {
      add(output, {
        id: stableId("FULL_EVENT", event.id),
        type: "FULL_EVENT",
        category: "OPERATIONAL",
        eventId: event.id,
        organizationId: event.host_organization_id,
        shortReason: "Full Event",
        suggestedAction: "View Event",
        relevantAt: event.starts_at,
        status: "OPEN",
        dueAt: event.starts_at,
      });
    }
    const hoursUntilStart = Date.parse(event.starts_at) - now.getTime();
    if (
      hoursUntilStart >= 0 &&
      hoursUntilStart <= 24 * 60 * 60 * 1000 &&
      activeCount < event.capacity * 0.25
    ) {
      add(output, {
        id: stableId("LOW_ATTENDANCE_EVENT", event.id),
        type: "LOW_ATTENDANCE_EVENT",
        category: "OPERATIONAL",
        eventId: event.id,
        organizationId: event.host_organization_id,
        shortReason: "Upcoming Class Conversation",
        suggestedAction: "View Event",
        relevantAt: event.starts_at,
        status: "OPEN",
        dueAt: event.starts_at,
      });
    }
  }

  return [...output.values()].sort((a, b) => Date.parse(a.relevantAt) - Date.parse(b.relevantAt));
}

/** Loads the projection only after the canonical System Admin authorization check. */
export async function getCommunityTouchpoints(now = new Date()) {
  await requireSystemAdmin("/admin/community");
  const db = await createClient();
  const [
    { data: registrations, error: registrationError },
    { data: events, error: eventError },
    { data: attendance, error: attendanceError },
    { data: publicationEvents, error: publicationError },
  ] = await Promise.all([
    db
      .from("registrations")
      .select(
        "id,participant_id,event_id,registration_status,registration_outcome,registered_at,cancelled_at",
      ),
    db
      .from("events")
      .select(
        "id,name,host_organization_id,starts_at,ends_at,capacity,status,publication_status,archived_at,created_at,last_published_at,event_series_id",
      ),
    db.from("attendance").select("registration_id,status,finalized_at"),
    db
      .from("audit_events")
      .select("entity_id,entity_type,action,created_at")
      .in("action", ["EVENT_PUBLISHED", "EVENT_SERIES_PUBLISHED"]),
  ]);
  if (registrationError) throw registrationError;
  if (eventError) throw eventError;
  if (attendanceError) throw attendanceError;
  if (publicationError) throw publicationError;
  return projectCommunityTouchpoints({
    registrations: (registrations ?? []) as CommunityRegistration[],
    events: (events ?? []) as CommunityEvent[],
    attendance: (attendance ?? []) as CommunityAttendance[],
    publicationEvents: (publicationEvents ?? []) as CommunityPublicationEvent[],
    now,
  });
}
