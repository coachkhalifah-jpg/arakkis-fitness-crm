import Link from "next/link";
import type { ReactNode } from "react";

export type ParticipantEventCardModel = {
  id: string;
  name: string;
  description?: string | null;
  date: { weekday: string; day: string; month: string };
  time: string;
  organizationName?: string;
  venueName?: string;
  spots: number;
  /** Register or browse destination when the card is a link. */
  href?: string;
  availability: string;
  imageUrl?: string;
  focalPosition?: string;
  titleColor?: string;
  /** When set, the participant already holds an active booking for this event. */
  manageHref?: string | null;
};

export function ParticipantEventCard({
  event,
  booked = Boolean(event.manageHref),
  href,
  asLink,
  footer,
  className,
}: {
  event: ParticipantEventCardModel;
  /** Force booked presentation (e.g. confirmation calendar). Defaults from manageHref. */
  booked?: boolean;
  /** Destination when rendered as a link. Defaults from booked/manageHref/href. */
  href?: string | null;
  /** When false, render a non-navigating shell (confirmation calendar + actions). */
  asLink?: boolean;
  /** Extra caption content (calendar actions). Replaces the manage-booking hint when set. */
  footer?: ReactNode;
  className?: string;
}) {
  const available = !booked && event.spots > 0 && event.availability === "OPEN";
  const status = booked
    ? "Booked"
    : available
      ? "Open"
      : event.availability === "LEGALLY_BLOCKED"
        ? "Booking paused"
        : event.spots > 0
          ? event.availability.toLowerCase().replaceAll("_", " ")
          : "Full";
  const resolvedHref = href ?? (booked ? (event.manageHref as string | null | undefined) : event.href);
  const link = asLink ?? Boolean(resolvedHref);
  const shellClassName = [
    "event-card-shell",
    "event-card-public-link",
    "participant-event-card",
    booked ? "is-booked" : available ? "is-available" : "is-unavailable",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const ariaLabel = `${event.name}, ${event.date.weekday} ${event.date.month} ${event.date.day}, ${event.time}, ${event.venueName ?? "Venue"}, ${status}${booked && link ? ", manage booking" : ""}`;

  const body = (
    <>
      <span
        className="event-card-media participant-event-card-hero"
        style={
          event.imageUrl
            ? {
                backgroundImage: `linear-gradient(135deg, rgba(22,34,30,.14), rgba(22,34,30,.48)), url(${event.imageUrl})`,
                backgroundPosition: event.focalPosition ?? "center",
              }
            : undefined
        }
      >
        <span
          className={`event-card-status participant-event-card-status ${booked ? "is-booked" : available ? "is-open" : ""}`}
        >
          {status}
        </span>
        <span className="event-card-title-overlay" style={{ color: event.titleColor ?? "#f7f5f0" }}>
          {event.name}
        </span>
      </span>
      <span className="event-card-caption participant-event-card-meta">
        <span className="event-card-metadata-grid">
          <span className="event-card-date-block">
            <span className="event-card-date-weekday">{event.date.weekday}</span>
            <span className="event-card-date-day">{event.date.day}</span>
            <span className="event-card-date-month">{event.date.month}</span>
          </span>
          <span className="event-card-details">
            <span className="event-card-time">{event.time}</span>
            <span className="event-card-location">
              <strong>{event.venueName ?? "Venue"}</strong>
            </span>
            {footer ? (
              footer
            ) : booked ? (
              <span className="participant-event-card-manage">Manage booking</span>
            ) : null}
          </span>
        </span>
      </span>
    </>
  );

  if (link && resolvedHref) {
    return (
      <Link href={resolvedHref} className={shellClassName} aria-label={ariaLabel}>
        {body}
      </Link>
    );
  }

  return (
    <article className={shellClassName} aria-label={ariaLabel}>
      {body}
    </article>
  );
}
