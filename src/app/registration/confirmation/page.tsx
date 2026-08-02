import Link from "next/link";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/db/server";
import { googleCalendarUrl, type CalendarEvent } from "@/lib/registration/calendar";
import { RememberDevice } from "@/components/registration/remember-device";

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
  FULL: "This class filled before your selection could be reserved.",
  CLOSED: "Registration closed before your selection could be reserved.",
  ALREADY_REGISTERED: "You already have an active registration for this class.",
  INELIGIBLE: "You are not eligible for this class.",
  NOT_FOUND: "This class is no longer available.",
};

const dateFormatter = (timezone: string) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  });

const timeFormatter = (timezone: string) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });

function instructionLines(instructions: string | null | undefined) {
  return (instructions ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function addressFor(event: ConfirmationEvent) {
  return [
    event.venue_street,
    [event.venue_city, event.venue_state, event.venue_postal_code].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
}

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
      <main className="mx-auto w-full max-w-[520px] px-4 py-10 sm:px-5 sm:py-14">
        <Card className="rounded-[28px] p-6 sm:p-8">
          <h1 className="text-2xl font-semibold text-ink">Confirmation unavailable</h1>
          <p className="mt-3 text-slate-600">This confirmation link is invalid or has expired.</p>
        </Card>
      </main>
    );

  const result = data as {
    participant_name: string;
    events: ConfirmationEvent[];
    expires_at: string;
  };
  const events = result.events ?? [];
  const successful = events.filter((event) => event.success);
  const firstName = result.participant_name.trim().split(/\s+/)[0] || "there";
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
    <main className="mx-auto w-full max-w-[520px] px-4 py-8 sm:px-5 sm:py-12">
      <Card className="overflow-hidden rounded-[30px] border-slate-200/80 bg-white/95 shadow-[0_18px_50px_rgba(15,23,42,0.10)]">
        <header className="px-6 pb-6 pt-8 text-center sm:px-8 sm:pt-10">
          <div
            className="confirmation-success-icon mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-brand">
            Registration confirmed
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">You’re booked!</h1>
          <p className="mx-auto mt-3 max-w-sm text-base leading-7 text-slate-600">
            We’re looking forward to seeing you, {firstName}.
          </p>
        </header>

        <div className="space-y-6 border-t border-slate-200/80 px-6 py-6 sm:px-8">
          {successful.length > 0 ? <RememberDevice confirmationToken={token} /> : null}

          <section aria-labelledby="booked-classes-heading">
            <h2 id="booked-classes-heading" className="text-lg font-semibold text-ink">
              Your class{successful.length === 1 ? "" : "es"}
            </h2>
            <div className="mt-4 space-y-4">
              {events.map((event) => {
                const instructions = instructionLines(event.participant_instructions);
                return (
                  <article
                    key={event.event_id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-ink">{event.name}</h3>
                        {event.success ? (
                          <div className="mt-3 space-y-1 text-sm leading-6 text-slate-600">
                            <p>{dateFormatter(event.timezone).format(new Date(event.starts_at))}</p>
                            <p>
                              {timeFormatter(event.timezone).format(new Date(event.starts_at))} –{" "}
                              {timeFormatter(event.timezone).format(new Date(event.ends_at))}
                            </p>
                            <p className="font-medium text-slate-700">{event.venue_name}</p>
                            <p>{addressFor(event)}</p>
                            <p>{event.host_organization_name}</p>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm leading-6 text-red-700">
                            {reasonText[event.reason ?? ""] ??
                              "This selection could not be reserved."}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                          event.success
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {event.success ? "Booked" : "Not booked"}
                      </span>
                    </div>

                    {event.success ? (
                      <>
                        {instructions.length > 0 ? (
                          <section
                            className="mt-5 border-t border-slate-200 pt-4"
                            aria-labelledby={`bring-${event.event_id}`}
                          >
                            <h4
                              id={`bring-${event.event_id}`}
                              className="text-sm font-semibold text-ink"
                            >
                              What to bring
                            </h4>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
                              {instructions.map((line, index) => (
                                <li key={`${event.event_id}-instruction-${index}`}>{line}</li>
                              ))}
                            </ul>
                          </section>
                        ) : null}

                        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-200 pt-4 text-sm">
                          <a
                            className="font-medium text-brand underline"
                            href={googleCalendarUrl(toCalendarEvent(event))}
                          >
                            Add to Google Calendar
                          </a>
                          <Link
                            className="font-medium text-brand underline"
                            href={`/registration/confirmation/ics?token=${encodeURIComponent(token)}&event=${encodeURIComponent(event.event_id)}`}
                          >
                            Download calendar file
                          </Link>
                        </div>

                        {event.communication_url ? (
                          <div className="mt-4 rounded-2xl bg-brand/[0.07] p-4">
                            <p className="text-sm font-semibold text-ink">
                              Stay connected with your class
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              Join the group for welcome notes and class updates.
                            </p>
                            <a
                              className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-brand px-4 py-2 font-semibold text-white transition hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                              href={event.communication_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {event.communication_label || "Join the group"}{" "}
                              <span aria-hidden="true">↗</span>
                              <span className="sr-only"> (opens in a new tab)</span>
                            </a>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          {successful.length > 0 ? (
            <a
              className="flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-center font-semibold text-ink transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              href={`/registration/confirmation/ics?token=${encodeURIComponent(token)}`}
            >
              Download all calendar files
            </a>
          ) : (
            <p className="text-sm leading-6 text-slate-600">
              No selected dates were successfully reserved.
            </p>
          )}

          <p className="text-center text-xs leading-5 text-slate-500">
            This read-only confirmation link expires in 24 hours.
          </p>
        </div>
      </Card>

      <nav className="mt-6 flex justify-center" aria-label="After booking">
        <Link className="text-sm font-semibold text-brand underline" href="/events">
          View more classes
        </Link>
      </nav>
    </main>
  );
}
