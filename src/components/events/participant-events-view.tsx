"use client";

import { useState } from "react";
import { DisclosureToggle } from "@/components/ui/disclosure-toggle";
import {
  ParticipantEventCard,
  type ParticipantEventCardModel,
} from "@/components/events/participant-event-card";

export type ParticipantEventCard = ParticipantEventCardModel;

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
        <ParticipantEventCard key={event.id} event={event} />
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
