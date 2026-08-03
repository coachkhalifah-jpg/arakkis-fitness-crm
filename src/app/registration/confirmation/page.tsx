import Link from "next/link";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/db/server";
import { googleCalendarUrl, type CalendarEvent } from "@/lib/registration/calendar";
import { RememberDevice } from "@/components/registration/remember-device";
import { WhatToBring } from "@/components/registration/what-to-bring";
import { CopyDirections } from "@/components/registration/copy-directions";
import { resolveRememberedParticipant } from "@/lib/registration/device";

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
    month: "short",
    day: "numeric",
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

function cityLineFor(event: ConfirmationEvent) {
  return [event.venue_city, event.venue_state, event.venue_postal_code].filter(Boolean).join(", ");
}

function bookingTitle(name: string) {
  const match = name.match(/^(.*?)(?:\s+—\s+(This Week|Next Week))$/);
  return {
    title: match?.[1] ?? name,
    week: match?.[2] ?? null,
  };
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
  const instructions = Array.from(
    new Set(successful.flatMap((event) => instructionLines(event.participant_instructions))),
  );
  const communicationEvent = successful.find((event) => event.communication_url);
  const directions = Array.from(
    new Map(
      successful.map((event) => [
        `${event.venue_name}|${addressFor(event)}`,
        { event, address: addressFor(event) },
      ]),
    ).values(),
  );
  const firstName = result.participant_name.trim().split(/\s+/)[0] || "there";
  const hasRememberedDevice = Boolean(await resolveRememberedParticipant());
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
    <main className="confirmation-page mx-auto w-full max-w-[520px] px-4 py-6 sm:px-5 sm:py-10">
      <Card className="confirmation-surface overflow-hidden rounded-[30px] shadow-[0_18px_50px_rgba(15,23,42,0.10)]">
        {hasRememberedDevice ? (
          <div className="confirmation-compact-banner" role="status">
            <span aria-hidden="true" className="text-lg font-bold text-emerald-700">
              ✓
            </span>
            <span>Bookings saved on this device</span>
          </div>
        ) : (
          <header className="confirmation-header px-6 pb-6 pt-7 text-center sm:px-8 sm:pt-8">
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
            <h1 className="confirmation-hero-title mt-5 text-sm uppercase text-brand">
              You&apos;re in!
            </h1>
            <p className="confirmation-welcome mx-auto mt-3 max-w-sm text-base text-[var(--confirmation-muted)]">
              We’re looking forward to seeing you, {firstName}.
            </p>
            {successful.length > 0 ? <RememberDevice confirmationToken={token} /> : null}
            <p className="confirmation-metadata mt-4 text-xs text-[var(--confirmation-muted)]">
              This confirmation link expires in 24 hours. Save this device to securely access your
              upcoming classes later.
            </p>
          </header>
        )}

        <div className="space-y-5 px-6 py-6 sm:px-8">
          {instructions.length > 0 ? (
            <section aria-label="What to bring">
              <WhatToBring eventId="confirmation" instructions={instructions} />
            </section>
          ) : null}

          {communicationEvent?.communication_url ? (
            <section className="confirmation-section" aria-labelledby="stay-connected-heading">
              <h2
                id="stay-connected-heading"
                className="confirmation-section-title text-center text-base"
              >
                Stay connected with your class
              </h2>
              <p className="confirmation-body mt-1 text-center text-sm text-[var(--confirmation-muted)]">
                Join the group for welcome notes and class updates.
              </p>
              <div className="mt-3 flex justify-center">
                <a
                  className="confirmation-pill-button confirmation-pill-button-primary"
                  href={communicationEvent.communication_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Join class chat <span aria-hidden="true">↗</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
            </section>
          ) : null}

          {successful.length > 0 ? (
            <section className="confirmation-section" aria-labelledby="calendar-heading">
              <h2
                id="calendar-heading"
                className="confirmation-section-title text-center text-base"
              >
                Add to calendar
              </h2>
              <div
                className={`confirmation-calendar-session-list mt-4${successful.length > 1 ? " is-multi" : ""}`}
              >
                {successful.map((event) => (
                  <div
                    key={event.event_id}
                    className="confirmation-calendar-row confirmation-calendar-session-card"
                  >
                    <p className="confirmation-event-title text-center text-sm font-semibold text-[var(--confirmation-text)]">
                      {bookingTitle(event.name).title}
                    </p>
                    <p className="confirmation-calendar-date text-center text-sm text-[var(--confirmation-text)]">
                      {dateFormatter(event.timezone).format(new Date(event.starts_at))}
                    </p>
                    <div className="confirmation-calendar-actions mt-2 flex flex-wrap items-center justify-center gap-2 text-sm">
                      <span className="confirmation-calendar-time">
                        {timeFormatter(event.timezone).format(new Date(event.starts_at))}
                      </span>
                      <a
                        className="confirmation-calendar-link confirmation-calendar-link-primary"
                        href={googleCalendarUrl(toCalendarEvent(event))}
                      >
                        Google Calendar
                      </a>
                      <Link
                        className="confirmation-calendar-link confirmation-calendar-link-secondary"
                        href={`/registration/confirmation/ics?token=${encodeURIComponent(token)}&event=${encodeURIComponent(event.event_id)}`}
                      >
                        iCal
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              <div className="confirmation-download-action mt-4 flex justify-center">
                <a
                  className="confirmation-calendar-download-link"
                  href={`/registration/confirmation/ics?token=${encodeURIComponent(token)}`}
                >
                  Download all calendar files
                </a>
              </div>
            </section>
          ) : null}

          {directions.length > 0 ? (
            <section className="confirmation-section" aria-labelledby="directions-heading">
              <h2
                id="directions-heading"
                className="confirmation-section-title text-center text-base"
              >
                Directions
              </h2>
              <div className="mt-3 space-y-4">
                {directions.map(({ event, address }) => (
                  <div key={`${event.event_id}-directions`}>
                    {directions.length > 1 ? (
                      <p className="confirmation-calendar-date text-sm text-[var(--confirmation-text)]">
                        {dateFormatter(event.timezone).format(new Date(event.starts_at))}
                      </p>
                    ) : null}
                    <div className="confirmation-address-block">
                      <div className="confirmation-address-title">
                        <p className="confirmation-metadata text-sm font-medium text-[var(--confirmation-text)]">
                          {event.venue_name}
                        </p>
                        <CopyDirections directions={`${event.venue_name} · ${address}`} />
                      </div>
                      <p className="confirmation-metadata mt-1 text-sm text-[var(--confirmation-muted)]">
                        {event.venue_street}
                      </p>
                      <p className="confirmation-metadata text-sm text-[var(--confirmation-muted)]">
                        {cityLineFor(event)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {events.some((event) => !event.success) ? (
            <section className="confirmation-section" aria-labelledby="unsuccessful-heading">
              <h2 id="unsuccessful-heading" className="confirmation-section-title text-base">
                Some selections were not booked
              </h2>
              <div className="confirmation-body mt-3 space-y-3 text-sm text-[var(--confirmation-muted)]">
                {events
                  .filter((event) => !event.success)
                  .map((event) => (
                    <p key={event.event_id}>
                      <span className="confirmation-event-title">
                        {bookingTitle(event.name).title}
                      </span>
                      : {reasonText[event.reason ?? ""] ?? "This selection could not be reserved."}
                    </p>
                  ))}
              </div>
            </section>
          ) : null}

          {successful.length === 0 ? (
            <p className="confirmation-body text-sm text-[var(--confirmation-muted)]">
              No selected dates were successfully reserved.
            </p>
          ) : null}

          {hasRememberedDevice ? (
            <p className="confirmation-metadata text-center text-xs text-[var(--confirmation-muted)]">
              This confirmation link expires in 24 hours.
            </p>
          ) : null}

          <nav aria-label="After booking">
            <div className="flex justify-center">
              <Link className="confirmation-browse-link" href="/events">
                Browse more classes
              </Link>
            </div>
          </nav>
        </div>
      </Card>
    </main>
  );
}
