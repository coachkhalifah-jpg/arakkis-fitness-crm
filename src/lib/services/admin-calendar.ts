import "server-only";

import type { AdminContext } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import type { CalendarEvent } from "@/lib/registration/calendar";

function weekEndFrom(now: Date) {
  const weekEnd = new Date(now);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + (7 - weekEnd.getUTCDay()));
  weekEnd.setUTCHours(23, 59, 59, 999);
  return weekEnd;
}

export async function getAuthorizedCalendarEvents(
  admin: AdminContext,
): Promise<CalendarEvent[] | null> {
  const now = new Date();
  const db = await createClient();
  let query = db
    .from("events")
    .select(
      "id,name,description,participant_instructions,starts_at,ends_at,timezone,venue_id,status,host_organization_id",
    )
    .gte("starts_at", now.toISOString())
    .lt("starts_at", weekEndFrom(now).toISOString())
    .neq("status", "CANCELLED")
    .order("starts_at", { ascending: true });
  if (admin.role === "HOST_ADMIN") query = query.in("host_organization_id", admin.organizationIds);
  const { data: events, error: eventError } = await query;
  if (eventError) return null;

  const venueIds = [
    ...new Set((events ?? []).flatMap((event) => (event.venue_id ? [event.venue_id] : []))),
  ];
  const { data: venues, error: venueError } = venueIds.length
    ? await db.from("venues").select("id,name,street,city,state,postal_code").in("id", venueIds)
    : { data: [], error: null };
  if (venueError) return null;
  const venueById = new Map((venues ?? []).map((venue) => [venue.id, venue]));

  return (events ?? []).map((event) => {
    const venue = event.venue_id ? venueById.get(event.venue_id) : null;
    return {
      eventId: event.id,
      name: event.name,
      description: event.description,
      participantInstructions: event.participant_instructions,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      timezone: event.timezone,
      venueName: venue?.name ?? "",
      venueStreet: venue?.street ?? "",
      venueCity: venue?.city ?? "",
      venueState: venue?.state ?? "",
      venuePostalCode: venue?.postal_code ?? "",
    } satisfies CalendarEvent;
  });
}

export function calendarEventFromRecord(
  event: {
    id: string;
    name: string;
    description?: string | null;
    participant_instructions?: string | null;
    starts_at: string;
    ends_at: string;
    timezone: string;
  },
  venue?: {
    name?: string | null;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
  } | null,
): CalendarEvent {
  return {
    eventId: event.id,
    name: event.name,
    description: event.description,
    participantInstructions: event.participant_instructions,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    timezone: event.timezone,
    venueName: venue?.name ?? "",
    venueStreet: venue?.street ?? "",
    venueCity: venue?.city ?? "",
    venueState: venue?.state ?? "",
    venuePostalCode: venue?.postal_code ?? "",
  };
}
