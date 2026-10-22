"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { attendancePresentation } from "@/lib/services/attendance-presentation";

type RosterPreviewPerson = {
  id: string;
  name: string;
  phone: string | null;
  attendanceStatus: string;
  attendanceState: string;
  firstClass: boolean;
};

const PREVIEW_LIMIT = 4;

export function RosterPreview({
  eventName,
  eventId,
  people,
  canViewPhone,
}: {
  eventName: string;
  eventId: string;
  people: RosterPreviewPerson[];
  canViewPhone: boolean;
}) {
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const hasMore = people.length > PREVIEW_LIMIT;
  const visiblePeople = expanded || !hasMore ? people : people.slice(0, PREVIEW_LIMIT);
  const hiddenCount = people.length - PREVIEW_LIMIT;

  return (
    <section className="admin-roster-preview" aria-labelledby="manage-event-roster-preview-title">
      <div className="admin-roster-preview-heading">
        <div>
          <p className="admin-roster-preview-kicker">Roster preview · {people.length} registered</p>
          <h3 id="manage-event-roster-preview-title">{eventName}</h3>
        </div>
        <span>
          {people.filter((person) => person.attendanceStatus === "ATTENDED").length} checked in
        </span>
        <a
          className="ops-invitation-submit admin-roster-download"
          href={`/admin/events/${eventId}/roster.csv`}
        >
          Download roster <span aria-hidden="true">↓</span>
        </a>
      </div>
      <ol
        id={listId}
        className="admin-roster-preview-list"
        aria-label="Roster preview participants"
      >
        {visiblePeople.map((person) => (
          <li key={person.id}>
            <span>
              <strong>
                <Link
                  href={`/admin/participants/${person.id}`}
                  className="admin-roster-preview-name"
                >
                  {person.name}
                </Link>
              </strong>
              {canViewPhone && person.phone ? <small>{person.phone}</small> : null}
            </span>
            <span className={person.attendanceStatus === "ATTENDED" ? "is-checked-in" : ""}>
              {attendancePresentation(person.attendanceStatus, person.attendanceState).label}
            </span>
          </li>
        ))}
      </ol>
      {!people.length ? (
        <p className="admin-roster-preview-empty">No participants registered.</p>
      ) : null}
      {hasMore ? (
        <button
          type="button"
          className="admin-roster-preview-more"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Show first 4" : `+ ${hiddenCount} more participants`}
        </button>
      ) : null}
    </section>
  );
}
