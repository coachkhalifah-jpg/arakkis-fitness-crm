"use client";

import Link from "next/link";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAdminEventCardRail } from "@/components/admin/admin-event-card-rail";

type EventPerson = {
  id: string;
  name: string;
  phone: string | null;
  attended: boolean;
  firstClass: boolean;
};
type CheckInAction = (formData: FormData) => Promise<void>;

export function AdminEventCard({
  event,
  venueName,
  startsAt,
  durationMinutes,
  image,
  count,
  firstClassCount,
  people,
  canViewPhone,
  canCheckIn,
  checkInAction,
  actions,
  cancelAction,
}: {
  event: {
    id: string;
    name: string;
    status: string;
    capacity: number;
    eventSeriesId: string | null;
  };
  venueName: string;
  startsAt: string;
  durationMinutes: number;
  image: string;
  count: { booked: number; checkedIn: number };
  firstClassCount: number;
  people: EventPerson[];
  canViewPhone: boolean;
  canCheckIn: boolean;
  checkInAction: CheckInAction;
  actions: ReactNode;
  cancelAction?: ReactNode;
}) {
  const rail = useAdminEventCardRail();
  const [localOpen, setLocalOpen] = useState(false);
  const open = rail ? rail.activeEventId === event.id : localOpen;
  const shellRef = useRef<HTMLElement>(null);

  function setOpen(nextOpen: boolean) {
    if (rail) rail.setActiveEventId(nextOpen ? event.id : null);
    else setLocalOpen(nextOpen);
  }

  useEffect(() => {
    if (open)
      shellRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [open]);

  return (
    <article
      ref={shellRef}
      className={`event-card-shell ${event.status === "CANCELLED" ? "event-card-shell-cancelled" : ""} ${open ? "event-card-shell-expanded" : ""}`}
    >
      <button
        type="button"
        className="event-card-trigger"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span
          className="event-card-media relative block"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(22,34,30,.14), rgba(22,34,30,.48)), url(${image})`,
          }}
        >
          <span className="absolute left-4 top-4 rounded-full bg-black/35 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[.16em] text-white backdrop-blur-sm">
            {event.status}
          </span>
        </span>
        <span className="event-card-caption block text-left">
          <strong className="event-card-title block">{event.name}</strong>
          <span className="mt-2 block text-xs text-slate-600">
            {venueName} · {startsAt}
          </span>
        </span>
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                className="admin-event-roster-backdrop"
                aria-label="Close event roster"
                onClick={() => setOpen(false)}
              />
              <div
                className="event-card-expanded-surface admin-event-roster-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`${event.name} roster`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="admin-eyebrow">Selected event</p>
                    <h3 className="mt-1 text-2xl font-semibold">Registration roster</h3>
                    <p className="mt-1 text-sm text-admin-text-muted">
                      {durationMinutes} minute class
                      {event.eventSeriesId ? " · recurring weekly" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="admin-icon-button"
                    aria-label="Close event roster"
                    onClick={() => setOpen(false)}
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                </div>
                <div className="event-roster-metrics mt-5" aria-label="Roster summary">
                  <span>
                    <strong>{count.booked}</strong> booked
                  </span>
                  <span>
                    <strong>{firstClassCount}</strong> first classes
                  </span>
                  <span>
                    <strong>{count.checkedIn}</strong> checked in
                  </span>
                  <span>
                    <strong>{Math.max(0, event.capacity - count.booked)}</strong> spots left
                  </span>
                </div>
                <div className="event-roster-table mt-5 overflow-auto">
                  {people.length ? (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-admin-border">
                          <th className="p-3 pl-0">Participant</th>
                          <th className="p-3">Attendance</th>
                          <th className="p-3 pr-0">Phone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {people.map((person) => (
                          <tr
                            key={person.id}
                            className="border-b border-admin-border last:border-0"
                          >
                            <td className="p-3 pl-0 font-semibold">
                              {person.name}
                              {person.firstClass ? (
                                <span className="first-class-badge ml-2">First Class</span>
                              ) : null}
                            </td>
                            <td className="p-3">
                              {person.attended ? (
                                "Checked in"
                              ) : canCheckIn ? (
                                <form action={checkInAction}>
                                  <input type="hidden" name="eventId" value={event.id} />
                                  <input type="hidden" name="registrationId" value={person.id} />
                                  <input type="hidden" name="status" value="ATTENDED" />
                                  <button
                                    type="submit"
                                    className="event-roster-check-in-button rounded-full bg-brand text-white transition hover:bg-brand/90 disabled:opacity-60"
                                  >
                                    Check in
                                  </button>
                                </form>
                              ) : (
                                "Not checked in"
                              )}
                            </td>
                            <td className="p-3 pr-0">
                              {canViewPhone && person.phone ? (
                                <a href={`tel:${person.phone}`} className="underline">
                                  {person.phone}
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="rounded-2xl bg-admin-surface-muted p-5 text-sm text-admin-text-muted">
                      No participants are registered for this event yet.
                    </p>
                  )}
                </div>
                <div className="event-roster-actions mt-5">
                  <Link className="admin-primary-button" href={`/admin/events/${event.id}`}>
                    Manage
                  </Link>
                  {actions}
                </div>
                {cancelAction ? (
                  <div className="event-roster-cancel-row">{cancelAction}</div>
                ) : null}
              </div>
            </>,
            document.body,
          )
        : null}
    </article>
  );
}
