"use client";

import { useCallback, useEffect, useRef, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { SubmitButton } from "@/components/admin/submit-button";
import {
  correctParticipantContact,
  type ParticipantContactActionState,
} from "@/lib/services/phase-6-actions";

type Participant = {
  id: string;
  first_name: string;
  last_name: string;
  display_phone: string;
  phone_country: string;
  email: string | null;
};

export function ParticipantContactCorrectionForm({ participant }: { participant: Participant }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const [state, action] = useActionState<ParticipantContactActionState, FormData>(
    correctParticipantContact,
    {},
  );

  const close = useCallback(() => {
    if (!open || closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      closeTimer.current = null;
    }, 750);
  }, [closing, open]);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  useEffect(() => {
    if (!state.success || !open) return;
    router.refresh();
  }, [open, router, state.success]);

  return (
    <section className="ops-venue-edit-panel" aria-labelledby="contact-correction-heading">
      <div className="ops-section-head">
        <span className="ops-kicker" id="contact-correction-heading">
          Contact
        </span>
        <button
          type="button"
          className="ops-org-add-link"
          data-testid="participant-edit-contact"
          onClick={() => {
            setClosing(false);
            setOpen(true);
          }}
        >
          EDIT CONTACT{" "}
          <span className="arakkis-arrow-icon" aria-hidden="true">
            ↗
          </span>
        </button>
      </div>
      <p className="ops-people-profile-copy">
        Name, phone, and email only. Participant ID and history stay unchanged. A matching identity
        is sent to review instead of being merged.
      </p>

      {open ? (
        <div className="admin-events-page admin-organization-create-shell">
          <div
            className={`admin-events-filter-overlay${closing ? " is-closing" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="participant-edit-contact-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <form
              action={action}
              className="admin-events-filter-sheet"
              data-testid="participant-contact-form"
            >
              <div className="admin-events-filter-sheet-top">
                <div>
                  <p className="admin-events-filter-kicker">People profile</p>
                  <h2 id="participant-edit-contact-title">Edit contact.</h2>
                </div>
                <button
                  type="button"
                  className="admin-events-filter-close"
                  onClick={close}
                  aria-label="Close contact editor"
                >
                  ×
                </button>
              </div>
              <input type="hidden" name="participantId" value={participant.id} />
              <div className="admin-events-filter-form">
                <label>
                  First name
                  <input
                    name="firstName"
                    required
                    maxLength={100}
                    defaultValue={participant.first_name}
                    autoFocus
                  />
                </label>
                <label>
                  Last name
                  <input
                    name="lastName"
                    required
                    maxLength={100}
                    defaultValue={participant.last_name}
                  />
                </label>
                <label>
                  Phone
                  <input
                    name="phone"
                    required
                    maxLength={40}
                    defaultValue={participant.display_phone}
                  />
                </label>
                <label>
                  Phone country
                  <input
                    name="phoneCountry"
                    required
                    maxLength={3}
                    defaultValue={participant.phone_country}
                    className="uppercase"
                  />
                </label>
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    maxLength={254}
                    defaultValue={participant.email ?? ""}
                  />
                </label>
                <label>
                  Reason for correction
                  <textarea name="reason" required maxLength={500} rows={3} />
                </label>
              </div>
              <div className="admin-events-filter-actions">
                <SubmitButton className="admin-events-filter-apply">
                  Save contact correction
                </SubmitButton>
                <button type="button" className="admin-events-filter-clear" onClick={close}>
                  Cancel
                </button>
              </div>
              {state.error ? (
                <p role="alert" className="ops-people-profile-message is-error">
                  {state.error}
                  {state.reviewCaseId ? ` Review case: ${state.reviewCaseId}.` : null}
                </p>
              ) : null}
              {state.success ? (
                <p role="status" className="ops-people-profile-message is-success">
                  {state.success}
                </p>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
