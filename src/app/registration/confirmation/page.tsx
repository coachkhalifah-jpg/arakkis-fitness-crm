import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PublicErrorState } from "@/components/registration/public-error-state";
import { createClient } from "@/lib/db/server";
import { googleCalendarUrl, type CalendarEvent } from "@/lib/registration/calendar";
import { WhatToBring } from "@/components/registration/what-to-bring";
import { CopyDirections } from "@/components/registration/copy-directions";
import { ArakkisCard } from "@/components/registration/arakkis-card";
import { ConfirmationCalendarCarousel } from "@/components/registration/confirmation-calendar-carousel";
import { googleMapsDirectionsUrl } from "@/lib/registration/maps";
import { CopyBookingLink } from "@/components/registration/copy-booking-link";
import { getConfirmationParticipantId } from "@/lib/registration/booking-management";
import { resolveRememberedParticipant } from "@/lib/registration/device";
import { eventCardAsset } from "@/lib/config/admin-visual-assets";
import { designAssetPublicUrl } from "@/lib/config/design-assets";

type ConfirmationEvent = CalendarEvent & {
  event_id: string;
  registration_id: string;
  event_title_color?: string | null;
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
  const street = event.venue_street?.trim();
  const city = event.venue_city?.trim();
  const state = event.venue_state?.trim();
  const postalCode = event.venue_postal_code?.trim();
  if (!street || !city || !state || !postalCode) return null;
  return `${street}, ${city}, ${state} ${postalCode}`;
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
      <PublicErrorState
        code="INVALID"
        title="Confirmation unavailable."
        message="This confirmation link is invalid or has expired."
        actionLabel="Browse events"
        actionHref="/events"
      />
    );

  const result = data as {
    participant_name: string;
    events: ConfirmationEvent[];
    expires_at: string;
  };
  const [rememberedParticipant, confirmationParticipantId] = await Promise.all([
    resolveRememberedParticipant(),
    getConfirmationParticipantId(token),
  ]);
  const isRememberedParticipant =
    rememberedParticipant?.participant_id === confirmationParticipantId;
  const events = result.events ?? [];
  const successful = events.filter((event) => event.success);
  const { data: eventImageAssets } = successful.length
    ? await db
        .from("design_assets")
        .select("event_id,storage_path,focal_position")
        .eq("asset_type", "EVENT_IMAGE_DESKTOP")
        .eq("active", true)
        .in(
          "event_id",
          successful.map((event) => event.event_id),
        )
    : { data: [] };
  const eventImageById = new Map(
    (eventImageAssets ?? []).map((asset) => [
      asset.event_id,
      designAssetPublicUrl(asset.storage_path),
    ]),
  );
  const eventImageFocalById = new Map(
    (eventImageAssets ?? []).map((asset) => [asset.event_id, asset.focal_position ?? "center"]),
  );
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
      <header className="confirmation-brand-header" aria-label="Arakkis">
        <span className="confirmation-brand">Arakkis</span>
      </header>
      <Card className="confirmation-surface overflow-hidden rounded-[30px] shadow-[0_18px_50px_rgba(15,23,42,0.10)]">
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
          <p className="confirmation-kicker">04 / Booking confirmed</p>
          <p className="confirmation-affirmation" aria-hidden="true">
            You&apos;re in! {firstName}
          </p>
          <h1 className="confirmation-hero-title mt-5">
            <span>See you</span>
            <span className="confirmation-hero-title-accent">there</span>
          </h1>
          <p className="confirmation-welcome mx-auto mt-8 max-w-sm text-base text-[var(--confirmation-muted)]">
            Your place is held. Here’s everything you need for a smooth arrival and a good session.
          </p>
          {successful.length > 0 && !isRememberedParticipant ? (
            <div className="confirmation-access-alert" aria-label="Remembered-device guidance">
              <p className="confirmation-access-alert-title">
                This device won’t remember your booking
              </p>
              <p>
                You didn’t choose <strong>Remember this device</strong>, so save the secure booking
                link to view or manage this reservation later.
              </p>
            </div>
          ) : null}
        </header>

        <div className="confirmation-content px-6 py-6 sm:px-8">
          {instructions.length > 0 ? (
            <section className="confirmation-section" aria-labelledby="what-to-bring-heading">
              <h2
                id="what-to-bring-heading"
                className="confirmation-section-heading confirmation-step-heading confirmation-step-heading-dark"
              >
                <span className="confirmation-step-marker">1</span>
                <span className="confirmation-step-copy">
                  <span className="confirmation-step-eyebrow">Prepare</span>
                  <span className="confirmation-step-title">What to bring</span>
                  <span className="confirmation-step-description">
                    A little preparation goes a long way. Open this when you&apos;re ready to get
                    set.
                  </span>
                </span>
              </h2>
              <WhatToBring eventId="confirmation" instructions={instructions} variant="northstar" />
            </section>
          ) : null}

          {successful.length > 0 ? (
            <section className="confirmation-section" aria-labelledby="calendar-heading">
              <h2
                id="calendar-heading"
                className="confirmation-section-heading confirmation-step-heading confirmation-section-title text-center text-base"
              >
                <span className="confirmation-step-marker">2</span>
                <span className="confirmation-step-copy">
                  <span className="confirmation-step-eyebrow">Save the time</span>
                  <span className="confirmation-step-title">Add to calendar</span>
                  <span className="confirmation-step-description">
                    Keep the selected occurrence close. You can add it to Google Calendar or
                    download an iCal file.
                  </span>
                </span>
              </h2>
              <ConfirmationCalendarCarousel>
                {successful.map((event, index) => (
                  <ArakkisCard
                    key={event.event_id}
                    className={`confirmation-calendar-row confirmation-calendar-session-card confirmation-calendar-card confirmation-calendar-event-card confirmation-event-art-${index % 3}`}
                  >
                    <span
                      className="confirmation-calendar-card-media"
                      style={{
                        backgroundImage: `linear-gradient(135deg, rgba(22,34,30,.14), rgba(22,34,30,.48)), url(${eventImageById.get(event.event_id) ?? eventCardAsset(event.name)})`,
                        backgroundPosition: eventImageFocalById.get(event.event_id) ?? "center",
                      }}
                    >
                      <span className="confirmation-booked-pill">BOOKED</span>
                      <span
                        className="confirmation-calendar-card-title"
                        style={{ color: event.event_title_color ?? "#FFFFFF" }}
                      >
                        {bookingTitle(event.name).title}
                      </span>
                    </span>
                    <span className="confirmation-calendar-card-caption">
                      <span className="confirmation-calendar-date-time">
                        <span className="confirmation-calendar-date">
                          <span>
                            {new Intl.DateTimeFormat("en-US", {
                              weekday: "short",
                              timeZone: event.timezone,
                            }).format(new Date(event.starts_at))}
                          </span>
                          <strong>
                            {new Intl.DateTimeFormat("en-US", {
                              month: "short",
                              day: "numeric",
                              timeZone: event.timezone,
                            }).format(new Date(event.starts_at))}
                          </strong>
                        </span>
                        <strong className="confirmation-calendar-time">
                          {timeFormatter(event.timezone).format(new Date(event.starts_at))}
                        </strong>
                      </span>
                      <span className="confirmation-calendar-organization block">
                        {event.host_organization_name}
                      </span>
                      <span className="confirmation-calendar-venue block">{event.venue_name}</span>
                      <span className="confirmation-calendar-actions">
                        <a
                          className="confirmation-calendar-link confirmation-calendar-link-primary"
                          href={googleCalendarUrl(toCalendarEvent(event))}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Google Calendar
                        </a>
                        <Link
                          className="confirmation-calendar-link confirmation-calendar-link-secondary"
                          href={`/registration/confirmation/ics?token=${encodeURIComponent(token)}&event=${encodeURIComponent(event.event_id)}`}
                        >
                          iCal
                        </Link>
                        <span
                          className="confirmation-calendar-actions-arrow arakkis-arrow-icon"
                          aria-hidden="true"
                        >
                          ←
                        </span>
                      </span>
                    </span>
                  </ArakkisCard>
                ))}
              </ConfirmationCalendarCarousel>
            </section>
          ) : null}

          {communicationEvent?.communication_url ? (
            <section className="confirmation-section" aria-labelledby="stay-connected-heading">
              <ArakkisCard
                interactive
                className="confirmation-next"
                aria-labelledby="stay-connected-heading"
              >
                <p className="confirmation-step-eyebrow">What&apos;s next?</p>
                <h2 id="stay-connected-heading" className="confirmation-next-title">
                  Keep the
                  <br />
                  <em>connection.</em>
                </h2>
                <p className="confirmation-body">
                  Your welcome details and class updates can live in the group chat.
                </p>
                <div className="mt-3 flex justify-center">
                  <a
                    className="confirmation-pill-button confirmation-pill-button-primary confirmation-action-button group-chat-button"
                    href={communicationEvent.communication_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="group-chat-dot" aria-hidden="true" />
                    Join class chat <b aria-hidden="true">↗</b>
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </div>
              </ArakkisCard>
            </section>
          ) : null}

          {directions.length > 0 ? (
            <section className="confirmation-section" aria-labelledby="directions-heading">
              <h2
                id="directions-heading"
                className="confirmation-section-heading confirmation-step-heading confirmation-section-title text-center text-base"
              >
                <span className="confirmation-step-marker">3</span>
                <span className="confirmation-step-copy">
                  <span className="confirmation-step-eyebrow">Find your way</span>
                  <span className="confirmation-step-title">Get directions</span>
                  <span className="confirmation-step-description">
                    You&apos;re headed to a familiar room. Copy the address or open directions when
                    you&apos;re on your way.
                  </span>
                </span>
              </h2>
              <div className="mt-3 space-y-4">
                {directions.map(({ event, address }) => (
                  <div key={`${event.event_id}-directions`}>
                    {directions.length > 1 ? (
                      <p className="confirmation-calendar-date text-sm text-[var(--confirmation-text)]">
                        {dateFormatter(event.timezone).format(new Date(event.starts_at))}
                      </p>
                    ) : null}
                    <ArakkisCard interactive className="confirmation-address-block">
                      <p className="confirmation-direction-venue-label">Venue</p>
                      <h3 className="confirmation-direction-venue">{event.venue_name}</h3>
                      <p className="confirmation-direction-address">{address}</p>
                      {address ? <CopyDirections directions={address} /> : null}
                      {googleMapsDirectionsUrl(address) ? (
                        <a
                          className="confirmation-pill-button confirmation-pill-button-secondary confirmation-directions-action confirmation-action-button confirmation-northstar-directions-button"
                          href={googleMapsDirectionsUrl(address) ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Get directions <span aria-hidden="true">↗</span>
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      ) : (
                        <p className="confirmation-metadata mt-3 text-xs">
                          Directions are unavailable for this venue.
                        </p>
                      )}
                    </ArakkisCard>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {successful.length > 0 ? (
            <section className="confirmation-booking-access" aria-label="Booking access">
              {isRememberedParticipant ? (
                <div className="confirmation-access-guidance confirmation-access-guidance-bottom">
                  <p>
                    You can return to Arakkis on this device anytime to view or manage your
                    bookings.
                  </p>
                </div>
              ) : null}
              <p className="confirmation-booking-access-heading">Keep your booking handy</p>
              <div className="confirmation-booking-access-list">
                {successful.map((event) => {
                  const bookingHref = `/manage-bookings/${encodeURIComponent(event.registration_id)}?confirmationToken=${encodeURIComponent(token)}`;
                  return (
                    <div
                      className="confirmation-booking-access-row"
                      key={`${event.event_id}-access`}
                    >
                      <span className="confirmation-booking-access-event">
                        <span className="confirmation-booking-access-date">
                          {new Intl.DateTimeFormat("en-US", {
                            weekday: "short",
                            timeZone: event.timezone,
                          }).format(new Date(event.starts_at))}
                          <span aria-hidden="true"> · </span>
                          {new Intl.DateTimeFormat("en-US", {
                            month: "short",
                            day: "numeric",
                            timeZone: event.timezone,
                          }).format(new Date(event.starts_at))}
                        </span>
                        <span>{bookingTitle(event.name).title}</span>
                      </span>
                      <span className="confirmation-booking-access-actions">
                        <Link
                          className="confirmation-calendar-link confirmation-calendar-link-secondary"
                          href={bookingHref}
                        >
                          View booking
                        </Link>
                        {!isRememberedParticipant ? <CopyBookingLink href={bookingHref} /> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {events.some((event) => !event.success) ? (
            <section
              className="confirmation-section confirmation-unsuccessful-card"
              aria-labelledby="unsuccessful-heading"
            >
              <div className="confirmation-unsuccessful-icon" aria-hidden="true">
                i
              </div>
              <div>
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
                        :{" "}
                        {reasonText[event.reason ?? ""] ?? "This selection could not be reserved."}
                      </p>
                    ))}
                </div>
              </div>
            </section>
          ) : null}

          {successful.length === 0 ? (
            <p className="confirmation-body text-sm text-[var(--confirmation-muted)]">
              No selected dates were successfully reserved.
            </p>
          ) : null}

          <p className="confirmation-metadata text-center text-xs text-[var(--confirmation-muted)]">
            This confirmation link expires in 24 hours.
          </p>

          <nav aria-label="After booking">
            <div className="flex justify-center">
              <Link className="confirmation-browse-link" href="/events">
                Browse more classes
              </Link>
            </div>
            <div className="mt-3 flex justify-center">
              <Link className="confirmation-browse-link" href="/legal/cancellation">
                Cancellation &amp; Refund Policy
              </Link>
            </div>
          </nav>
        </div>
      </Card>
    </main>
  );
}
