import { NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { icsContent, type CalendarEvent } from "@/lib/registration/calendar";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const eventId = request.nextUrl.searchParams.get("event");
  const db = await createClient();
  const { data, error } = await db.rpc("get_registration_confirmation", {
    p_token: token,
  } as never);
  if (error || !data) return new Response("Confirmation unavailable", { status: 404 });
  const result = data as { events: Array<Record<string, unknown>> };
  const events = result.events
    .filter((event) => event.success && (!eventId || event.event_id === eventId))
    .map((event) => ({
      eventId: String(event.event_id),
      name: String(event.name),
      description: event.description as string | null,
      participantInstructions: event.participant_instructions as string | null,
      startsAt: String(event.starts_at),
      endsAt: String(event.ends_at),
      timezone: String(event.timezone),
      venueName: String(event.venue_name),
      venueStreet: String(event.venue_street),
      venueCity: String(event.venue_city),
      venueState: String(event.venue_state),
      venuePostalCode: String(event.venue_postal_code),
    })) as CalendarEvent[];
  if (events.length === 0) return new Response("No authorized calendar events", { status: 404 });
  return new Response(icsContent(events), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="fitness-events.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
