"use client";

import { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { RegistrationRosterRow } from "@/components/admin/registration-roster";
import { RemoveRosterAction } from "@/components/admin/remove-roster-action";
import type { Phase3ActionState } from "@/lib/services/phase-3-actions";
import { getDialogFocusableElements } from "@/components/admin/dialog-focus";
import { attendancePresentation } from "@/lib/services/attendance-presentation";

type ServerAction = (formData: FormData) => Promise<void>;
type RosterAction = (state: Phase3ActionState, formData: FormData) => Promise<Phase3ActionState>;

export type ManageEventRosterDialogProps = {
  eventId: string;
  eventName: string;
  rows: RegistrationRosterRow[];
  dateTime: string;
  venue: string;
  attendanceState: string;
  registered: number;
  checkedIn: number;
  capacity: number;
  canEdit: boolean;
  checkInAction: ServerAction;
  removeRegistrationAction: RosterAction;
  canRemoveRegistration: boolean;
};

export function ManageEventRosterDialog({
  open,
  onClose,
  eventId,
  eventName,
  rows,
  dateTime,
  venue,
  attendanceState,
  registered,
  checkedIn,
  capacity,
  canEdit,
  checkInAction,
  removeRegistrationAction,
  canRemoveRegistration,
}: ManageEventRosterDialogProps & { open: boolean; onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!open) return;
    const modal = modalRef.current;
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => getDialogFocusableElements(modal);
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) return;
      if (event.shiftKey && document.activeElement === elements[0]) {
        event.preventDefault();
        elements.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === elements.at(-1)) {
        event.preventDefault();
        elements[0]?.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (modal.contains(event.target as Node)) return;
      focusable()[0]?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      previous?.focus();
    };
  }, [close, open]);

  if (!open) return null;
  return (
    <>
      <button
        type="button"
        className="admin-event-roster-backdrop"
        aria-label="Close event roster"
        onClick={close}
      />
      <div
        ref={modalRef}
        className="event-card-expanded-surface admin-event-roster-modal admin-manage-roster-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-event-roster-title"
      >
        <div className="event-roster-modal-context">
          <div className="event-roster-modal-header">
            <div>
              <p className="event-roster-modal-kicker">Event roster</p>
              <h2 id="manage-event-roster-title" className="event-roster-modal-title">
                {eventName}
              </h2>
            </div>
            <button
              type="button"
              className="admin-icon-button event-roster-modal-close"
              aria-label="Close event roster"
              onClick={close}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="event-roster-modal-event-meta">
            <p className="event-roster-modal-date">{dateTime}</p>
            <p className="event-roster-modal-venue">{venue}</p>
            <p className="event-roster-modal-status">
              {registered} / {capacity} registered · {checkedIn} checked in · {attendanceState}
            </p>
          </div>
        </div>
        <div className="admin-manage-roster-list">
          {rows.length ? (
            rows.map((row) => {
              const checkedInState = row.attendanceStatus === "ATTENDED";
              const presentation = attendancePresentation(row.attendanceStatus, attendanceState);
              return (
                <article key={row.id} className="admin-manage-roster-row">
                  <div className="admin-manage-roster-person">
                    <h3>
                      {row.participantName}
                      {row.firstClass ? (
                        <span className="event-roster-first-class">First class</span>
                      ) : null}
                    </h3>
                    {row.phone ? <p>{row.phone}</p> : null}
                  </div>
                  <div className="admin-manage-roster-actions">
                    {canEdit && row.registrationStatus !== "CANCELLED" ? (
                      <form action={checkInAction}>
                        <input type="hidden" name="eventId" value={eventId} />
                        <input type="hidden" name="registrationId" value={row.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={checkedInState ? "NOT_RECORDED" : "ATTENDED"}
                        />
                        <button
                          type="submit"
                          className={
                            checkedInState
                              ? "admin-manage-roster-check-in is-checked-in"
                              : "admin-manage-roster-check-in"
                          }
                        >
                          {checkedInState ? "IN" : "Check in"}
                        </button>
                      </form>
                    ) : (
                      <span
                        className={
                          presentation.kind === "attended"
                            ? "admin-manage-roster-status is-checked-in"
                            : "admin-manage-roster-status"
                        }
                      >
                        {presentation.label}
                      </span>
                    )}
                    {canRemoveRegistration ? (
                      <RemoveRosterAction
                        action={removeRegistrationAction}
                        eventId={eventId}
                        eventName={eventName}
                        registrationId={row.id}
                        participantName={row.participantName}
                      />
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <p className="admin-manage-roster-empty">
              No participants are registered for this event yet.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
