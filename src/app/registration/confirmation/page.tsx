import Link from "next/link";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/db/server";
import { googleCalendarUrl, type CalendarEvent } from "@/lib/registration/calendar";

type ConfirmationEvent = CalendarEvent & {
  event_id: string;
  success: boolean;
  reason?: string | null;
  venue_name: string;
  venue_street: string;
  venue_city: string;
  venue_state: string;
  venue_postal_code: string;
  starts_at: string;
  ends_at: string;
  participant_instructions?: string | null;
  host_organization_name: string;
  communication_url?: string | null;
  communication_label?: string | null;
};
const reasonText: Record<string, string> = {
  FULL: "Event full",
  CLOSED: "Registration closed",
  ALREADY_REGISTERED: "Already registered",
  INELIGIBLE: "Not eligible for this date",
  NOT_FOUND: "Date unavailable",
};

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token ?? "";
  const db = await createClient();
  const { data, error } = await db.rpc("get_registration_confirmation", {
    p_token: token,
  } as never);
  if (error || !data)
    return (
      <section className="mx-auto max-w-3xl px-6 py-12">
        <Card className="p-8">
          <h1 className="text-2xl font-semibold">Confirmation unavailable</h1>
          <p className="mt-3 text-slate-600">This confirmation link is invalid or has expired.</p>
        </Card>
      </section>
    );
  const result = data as {
    participant_name: string;
    events: ConfirmationEvent[];
    expires_at: string;
  };
  const events = result.events ?? [];
  const successful = events.filter((event) => event.success);
  const toCalendarEvent = (event: ConfirmationEvent): CalendarEvent => ({
    eventId: event.event_id,
    name: event.name,
    description: event.description,
    participantInstructions: event.participant_instructions,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    timezone: event.timezone,
    venueName: event.venue_name,
    venueStreet: event.venue_street,
    venueCity: event.venue_city,
    venueState: event.venue_state,
    venuePostalCode: event.venue_postal_code,
  });
  return (
    <section className="mx-auto max-w-4xl space-y-6 px-6 py-12">
      <Card className="p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
          Registration confirmation
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Thanks, {result.participant_name}</h1>
        <p className="mt-3 text-slate-600">This read-only confirmation link expires in 24 hours.</p>
        <a
          className="mt-5 inline-block rounded-md bg-brand px-4 py-2 font-medium text-white"
          href={`/registration/confirmation/ics?token=${encodeURIComponent(token)}`}
        >
          Download all successful dates (.ics)
        </a>
      </Card>
      <div className="space-y-3">
        {events.map((event) => (
          <Card key={event.event_id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{event.name}</h2>
                {event.success ? (
                  <>
                    <p className="text-slate-600">
                      {new Intl.DateTimeFormat("en-US", {
                        dateStyle: "full",
                        timeStyle: "short",
                        timeZone: event.timezone,
                      }).format(new Date(event.starts_at))}
                    </p>
                    <p className="text-slate-600">
                      {event.venue_name}, {event.venue_city}, {event.venue_state}
                    </p>
                  </>
                ) : (
                  <p className="text-red-700">{reasonText[event.reason ?? ""] ?? "Unavailable"}</p>
                )}
              </div>
              {event.success ? (
                <span className="rounded bg-green-100 px-2 py-1 text-sm text-green-800">
                  Registered
                </span>
              ) : (
                <span className="rounded bg-slate-100 px-2 py-1 text-sm">Not registered</span>
              )}
            </div>
            {event.success ? (
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <a
                  className="text-brand underline"
                  href={googleCalendarUrl(toCalendarEvent(event))}
                >
                  Add to Google Calendar
                </a>
                <Link
                  className="text-brand underline"
                  href={`/registration/confirmation/ics?token=${encodeURIComponent(token)}&event=${encodeURIComponent(event.event_id)}`}
                >
                  Download .ics
                </Link>
                {event.communication_url ? (
                  <span className="flex w-full items-center gap-3 pt-2">
                    <span className="font-medium text-slate-600">
                      Stay connected with the group
                    </span>
                    <a
                      className="rounded-xl bg-brand px-4 py-2 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-brand-dark"
                      href={event.communication_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {event.communication_label || "Join the group"} ↗
                    </a>
                  </span>
                ) : null}
              </div>
            ) : null}
          </Card>
        ))}
      </div>
      {successful.length === 0 ? (
        <p className="text-slate-600">No selected dates were successfully reserved.</p>
      ) : null}
    </section>
  );
}
