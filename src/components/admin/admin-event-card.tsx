"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAdminEventCardRail } from "@/components/admin/admin-event-card-rail";
import { RemoveRosterAction } from "@/components/admin/remove-roster-action";
import { DisclosureToggle } from "@/components/ui/disclosure-toggle";
import { getDialogFocusableElements } from "@/components/admin/dialog-focus";
import type { Phase3ActionState } from "@/lib/services/phase-3-actions";
import { attendancePresentation } from "@/lib/services/attendance-presentation";

type EventPerson = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  registrationStatus: string;
  attendanceStatus: string;
  firstClass: boolean;
};
type CheckInAction = (formData: FormData) => Promise<void>;

function eventStatusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function attendanceStateLabel(status: string) {
  return status.replaceAll("_", " ");
}

export function AdminEventCard({
  event,
  venueName,
  date,
  timeLabel,
  durationMinutes,
  image,
  focalPosition,
  count,
  firstClassCount,
  people,
  canViewPhone,
  canCheckIn,
  checkInAction,
  removeRegistrationAction,
  canRemoveRegistration,
  actions,
  cancelAction,
}: {
  event: {
    id: string;
    name: string;
    eventTitleColor?: string | null;
    status: string;
    publicationStatus: string;
    capacity: number;
    eventSeriesId: string | null;
    attendanceState: string;
  };
  venueName: string;
  date: { weekday: string; day: string; month: string };
  timeLabel: string;
  durationMinutes: number;
  image: string;
  focalPosition?: string;
  count: { booked: number; checkedIn: number };
  firstClassCount: number;
  people: EventPerson[];
  canViewPhone: boolean;
  canCheckIn: boolean;
  checkInAction: CheckInAction;
  removeRegistrationAction: (
    state: Phase3ActionState,
    formData: FormData,
  ) => Promise<Phase3ActionState>;
  canRemoveRegistration: boolean;
  actions: ReactNode;
  cancelAction?: ReactNode;
}) {
  const rail = useAdminEventCardRail();
  const [localOpen, setLocalOpen] = useState(false);
  const open = rail ? rail.activeEventId === event.id : localOpen;
  const shellRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const visiblePeople = people;

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (rail) rail.setActiveEventId(nextOpen ? event.id : null);
      else setLocalOpen(nextOpen);
    },
    [event.id, rail],
  );

  useEffect(() => {
    if (open)
      shellRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const modal = modalRef.current;
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const trigger = triggerRef.current;
    const focusable = () => getDialogFocusableElements(modal);
    focusable()[0]?.focus();
    const onKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") {
        keyboardEvent.preventDefault();
        setOpen(false);
        return;
      }
      if (keyboardEvent.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (keyboardEvent.shiftKey && document.activeElement === first) {
        keyboardEvent.preventDefault();
        last.focus();
      } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
        keyboardEvent.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (focusEvent: FocusEvent) => {
      if (modal.contains(focusEvent.target as Node)) return;
      focusable()[0]?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      trigger?.focus();
      if (!trigger) previous?.focus();
    };
  }, [open, setOpen]);

  return (
    <article
      ref={shellRef}
      className={`event-card-shell event-card-admin ${event.status === "CANCELLED" ? "event-card-shell-cancelled" : ""} ${open ? "event-card-shell-expanded" : ""}`}
    >
      <DisclosureToggle
        ref={triggerRef}
        className="event-card-trigger"
        expanded={open}
        controls={`event-roster-${event.id}`}
        showIcon={false}
        onClick={() => setOpen(!open)}
      >
        <span
          className="event-card-media relative block"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(22,34,30,.14), rgba(22,34,30,.48)), url(${image})`,
            backgroundPosition: focalPosition ?? "center",
          }}
        >
          <span className="event-card-status">{eventStatusLabel(event.status)}</span>
          <span
            className="event-card-title-overlay"
            style={{ color: event.eventTitleColor ?? "#FFFFFF" }}
          >
            {event.name}
          </span>
        </span>
        <span className="event-card-caption block text-left">
          <span className="event-card-metadata-grid">
            <span className="event-card-date-block">
              <span className="event-card-date-weekday block text-[0.65rem] font-bold uppercase tracking-[0.14em]">
                {date.weekday}
              </span>
              <span className="event-card-date-day my-0.5 block text-2xl font-bold tracking-tight">
                {date.day}
              </span>
              <span className="event-card-date-month block text-[0.65rem] font-bold uppercase tracking-[0.14em]">
                {date.month}
              </span>
            </span>
            <span className="event-card-details">
              <span className="event-card-time">{timeLabel}</span>
              <span className="event-card-capacity">
                <strong>
                  {count.booked} / {event.capacity}
                </strong>
              </span>
            </span>
          </span>
        </span>
      </DisclosureToggle>
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
                ref={modalRef}
                id={`event-roster-${event.id}`}
                className="event-card-expanded-surface admin-event-roster-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`event-roster-title-${event.id}`}
              >
                <div className="event-roster-modal-context">
                  <div className="event-roster-modal-header">
                    <div>
                      <p className="event-roster-modal-kicker">Event roster</p>
                      <h3
                        id={`event-roster-title-${event.id}`}
                        className="event-roster-modal-title"
                      >
                        {event.name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      className="admin-icon-button event-roster-modal-close"
                      aria-label="Close event roster"
                      onClick={() => setOpen(false)}
                    >
                      <X size={20} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="event-roster-modal-event-meta">
                    <p className="event-roster-modal-date">
                      {date.weekday} · {date.month} {date.day} · {timeLabel}
                    </p>
                    <p className="event-roster-modal-venue">{venueName}</p>
                    <p className="event-roster-modal-status">
                      {event.publicationStatus} · {count.booked} / {event.capacity}
                    </p>
                  </div>
                  <div className="event-roster-metrics mt-5" aria-label="Roster summary">
                    <span>
                      <strong>{count.booked}</strong> registered
                    </span>
                    <span>
                      <strong>{count.checkedIn}</strong> checked in
                    </span>
                    <span>
                      <strong>
                        {canCheckIn ? "Open" : attendanceStateLabel(event.attendanceState)}
                      </strong>{" "}
                      check-in
                    </span>
                  </div>
                </div>
                <div className="event-roster-table event-roster-desktop mt-5 overflow-auto">
                  {visiblePeople.length ? (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-admin-border">
                          <th className="p-3 pl-0">Participant</th>
                          <th className="p-3">Attendance</th>
                          <th className="p-3">Phone</th>
                          <th className="p-3 pr-0 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visiblePeople.map((person) => (
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
                              {person.attendanceStatus === "ATTENDED" && canCheckIn ? (
                                <form action={checkInAction}>
                                  <input type="hidden" name="eventId" value={event.id} />
                                  <input type="hidden" name="registrationId" value={person.id} />
                                  <input type="hidden" name="status" value="NOT_RECORDED" />
                                  <button type="submit" className="event-roster-check-in-state">
                                    IN
                                    <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                                  </button>
                                </form>
                              ) : person.attendanceStatus === "ATTENDED" ? (
                                <span className="event-roster-check-in-state">
                                  IN
                                  <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                                </span>
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
                                attendancePresentation(
                                  person.attendanceStatus,
                                  event.attendanceState,
                                ).label
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
                            <td className="p-3 pr-0 text-right">
                              {canRemoveRegistration ? (
                                <RemoveRosterAction
                                  action={removeRegistrationAction}
                                  eventId={event.id}
                                  eventName={event.name}
                                  registrationId={person.id}
                                  participantName={person.name}
                                />
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="event-roster-empty">
                      {people.length
                        ? "No participants match this search."
                        : "No participants are registered for this event yet."}
                    </p>
                  )}
                </div>
                <div className="event-roster-mobile mt-5" aria-label="Mobile registration roster">
                  {visiblePeople.length ? (
                    visiblePeople.map((person) => (
                      <article key={person.id} className="event-roster-mobile-record">
                        <h4>
                          {person.name}
                          {person.firstClass ? (
                            <span className="event-roster-first-class">First class</span>
                          ) : null}
                        </h4>
                        <div className="event-roster-mobile-main">
                          <div className="event-roster-meta">
                            <p className="text-sm text-admin-text-muted">
                              {!person.firstClass ? "Returning participant" : null}
                              {!person.firstClass && canViewPhone && person.phone ? " · " : ""}
                              {canViewPhone && person.phone ? (
                                <a href={`tel:${person.phone}`} className="underline">
                                  {person.phone}
                                </a>
                              ) : null}
                            </p>
                          </div>
                          <div className="event-roster-mobile-actions">
                            <div className="event-roster-mobile-check-in">
                              {person.attendanceStatus === "ATTENDED" && canCheckIn ? (
                                <form action={checkInAction}>
                                  <input type="hidden" name="eventId" value={event.id} />
                                  <input type="hidden" name="registrationId" value={person.id} />
                                  <input type="hidden" name="status" value="NOT_RECORDED" />
                                  <button type="submit" className="event-roster-check-in-state">
                                    IN
                                    <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                                  </button>
                                </form>
                              ) : person.attendanceStatus === "ATTENDED" ? (
                                <span className="event-roster-check-in-state">
                                  IN
                                  <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                                </span>
                              ) : canCheckIn ? (
                                <form action={checkInAction}>
                                  <input type="hidden" name="eventId" value={event.id} />
                                  <input type="hidden" name="registrationId" value={person.id} />
                                  <input type="hidden" name="status" value="ATTENDED" />
                                  <button
                                    type="submit"
                                    className="event-roster-check-in-button w-full rounded-none border border-brand bg-transparent text-admin-text transition hover:bg-brand hover:text-white disabled:opacity-60"
                                  >
                                    Check in
                                  </button>
                                </form>
                              ) : (
                                <span className="text-sm text-admin-text-muted">
                                  {
                                    attendancePresentation(
                                      person.attendanceStatus,
                                      event.attendanceState,
                                    ).label
                                  }
                                </span>
                              )}
                            </div>
                            {canRemoveRegistration ? (
                              <RemoveRosterAction
                                action={removeRegistrationAction}
                                eventId={event.id}
                                eventName={event.name}
                                registrationId={person.id}
                                participantName={person.name}
                              />
                            ) : null}
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="event-roster-empty">
                      {people.length
                        ? "No participants match this search."
                        : "No participants are registered for this event yet."}
                    </p>
                  )}
                </div>
                <div className="event-roster-actions mt-5">
                  <Link className="admin-primary-button" href={`/admin/events/${event.id}`}>
                    Manage event context ↗
                  </Link>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </article>
  );
}
