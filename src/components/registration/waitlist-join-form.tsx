"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  joinEventWaitlistAction,
  type WaitlistJoinActionState,
} from "@/lib/registration/waitlist-actions";

const initialState: WaitlistJoinActionState = {};

export function WaitlistJoinForm({
  eventId,
  eventLabel,
  eventInviteToken = null,
}: {
  eventId: string;
  eventLabel: string;
  eventInviteToken?: string | null;
}) {
  const [state, action, pending] = useActionState(joinEventWaitlistAction, initialState);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state.error]);

  if (state.success && state.removeUrl) {
    return (
      <div className="waitlist-join-success" role="status">
        <p className="waitlist-join-success-title">You’re on the interest list.</p>
        <p className="waitlist-join-success-copy">
          This does not reserve a seat. Save this link if you want to remove yourself later:
        </p>
        <p className="waitlist-join-remove-link">
          <a href={state.removeUrl}>{state.removeUrl}</a>
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="waitlist-join-form">
      <input type="hidden" name="eventId" value={eventId} />
      {eventInviteToken ? (
        <input type="hidden" name="eventInviteToken" value={eventInviteToken} />
      ) : null}
      <p className="waitlist-join-eyebrow">Class is full</p>
      <h2 className="waitlist-join-title">Leave your interest</h2>
      <p className="waitlist-join-copy">
        {eventLabel} is at capacity. Share your name and contact so the host can see demand. This
        does not reserve a seat and does not mean you’ll be contacted automatically.
      </p>
      {state.error ? (
        <p ref={errorRef} tabIndex={-1} className="waitlist-join-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <label className="waitlist-join-field">
        Name
        <input
          name="displayName"
          required
          maxLength={200}
          autoComplete="name"
          className="registration-field-control mt-2 w-full px-3 outline-none transition"
          aria-invalid={Boolean(state.fieldErrors?.displayName)}
        />
        {state.fieldErrors?.displayName ? (
          <span className="waitlist-join-field-error">{state.fieldErrors.displayName}</span>
        ) : null}
      </label>
      <label className="waitlist-join-field">
        Phone or email
        <input
          name="contact"
          required
          maxLength={254}
          autoComplete="tel"
          className="registration-field-control mt-2 w-full px-3 outline-none transition"
          aria-invalid={Boolean(state.fieldErrors?.contact)}
        />
        {state.fieldErrors?.contact ? (
          <span className="waitlist-join-field-error">{state.fieldErrors.contact}</span>
        ) : null}
      </label>
      <button type="submit" className="registration-reserve-button" disabled={pending}>
        {pending ? "Saving…" : "Join interest list"}
      </button>
    </form>
  );
}
