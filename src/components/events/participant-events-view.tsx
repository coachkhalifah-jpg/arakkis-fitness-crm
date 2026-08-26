"use client";

import Link from "next/link";
import { useState } from "react";
import { DisclosureToggle } from "@/components/ui/disclosure-toggle";

export type ParticipantEventCard = {
  id: string;
  name: string;
  description?: string | null;
  date: { weekday: string; day: string; month: string };
  time: string;
  organizationName?: string;
  venueName?: string;
  spots: number;
  href: string;
  availability: string;
  imageUrl?: string;
  focalPosition?: string;
  titleColor?: string;
};

function EventCard({ event }: { event: ParticipantEventCard }) {
  const available = event.spots > 0 && event.availability === "OPEN";
  const status = available
    ? "Open"
    : event.availability === "LEGALLY_BLOCKED"
      ? "Booking paused"
      : event.spots > 0
        ? event.availability.toLowerCase().replaceAll("_", " ")
        : "Full";

  return (
    <Link
      href={event.href}
      className={`event-card-shell event-card-public-link participant-event-card ${available ? "is-available" : "is-unavailable"}`}
      aria-label={`${event.name}, ${event.date.weekday} ${event.date.month} ${event.date.day}, ${event.time}, ${event.venueName ?? "Venue"}, ${status}`}
    >
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
          className={`event-card-status participant-event-card-status ${available ? "is-open" : ""}`}
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
          </span>
        </span>
      </span>
    </Link>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="participant-events-section-heading">
      <p className="participant-events-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function EventGrid({ events }: { events: ParticipantEventCard[] }) {
  return (
    <div className="event-card-carousel participant-event-grid" aria-label="Available Events">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}

function OrganizationList({
  organizations,
}: {
  organizations: Array<{
    name: string;
    description: string;
    events: ParticipantEventCard[];
  }>;
}) {
  const [expandedOrganization, setExpandedOrganization] = useState<string | null>(null);

  return (
    <section
      className="participant-events-section participant-events-organizations"
      aria-labelledby="participant-organizations-heading"
    >
      <div className="participant-events-organizations-heading">
        <p className="participant-events-eyebrow">My organizations</p>
        <h2 id="participant-organizations-heading">Places you belong.</h2>
        <p>Expand an Organization to see its Events and recurring practices.</p>
      </div>
      <div className="participant-events-organization-list">
        {organizations.map((organization) => {
          const organizationId = `participant-organization-${organization.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
          const expanded = expandedOrganization === organizationId;
          return (
            <div className="participant-events-organization" key={organization.name}>
              <DisclosureToggle
                className="participant-events-organization-toggle"
                expanded={expanded}
                controls={`${organizationId}-events`}
                onClick={() => setExpandedOrganization(expanded ? null : organizationId)}
              >
                <strong>{organization.name}</strong>
                <span className="participant-events-organization-description">
                  {organization.description}
                </span>
                <span className="participant-events-organization-count">
                  {organization.events.length}{" "}
                  {organization.events.length === 1 ? "series" : "series"}
                </span>
              </DisclosureToggle>
              {expanded ? (
                <div
                  id={`${organizationId}-events`}
                  className="participant-events-organization-events"
                >
                  <EventGrid events={organization.events} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ParticipantEventsView({
  thisWeek,
  upcomingByOrganization,
}: {
  thisWeek: ParticipantEventCard[];
  upcomingByOrganization: Array<{
    name: string;
    description: string;
    events: ParticipantEventCard[];
  }>;
}) {
  return (
    <div className="participant-events-content">
      {thisWeek.length ? (
        <section
          className="participant-events-section"
          aria-labelledby="participant-this-week-heading"
        >
          <SectionHeading
            eyebrow="This week"
            title="Already in your rhythm."
            description="Upcoming Events from the Organizations and places available to you."
          />
          <EventGrid events={thisWeek} />
        </section>
      ) : null}

      {upcomingByOrganization.length ? (
        <OrganizationList organizations={upcomingByOrganization} />
      ) : null}
    </div>
  );
}
