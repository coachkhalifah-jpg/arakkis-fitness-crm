"use client";

import { useActionState } from "react";
import {
  removeEventWaitlistAction,
  type WaitlistRemoveActionState,
} from "@/lib/registration/waitlist-actions";

const initialState: WaitlistRemoveActionState = {};

export function WaitlistRemoveForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(removeEventWaitlistAction, initialState);

  if (state.success) {
    return (
      <div className="waitlist-remove-success" role="status">
        <h1 className="waitlist-join-title">
          {state.alreadyRemoved ? "Already removed" : "Removed from the interest list"}
        </h1>
        <p className="waitlist-join-copy">
          {state.alreadyRemoved
            ? "This interest list entry was already removed."
            : "You’re no longer on the interest list for this class."}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="waitlist-join-form">
      <input type="hidden" name="token" value={token} />
      <h1 className="waitlist-join-title">Remove yourself</h1>
      <p className="waitlist-join-copy">
        Confirm to leave the interest list for this class. This does not affect any registration.
      </p>
      {state.error ? (
        <p className="waitlist-join-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="registration-reserve-button" disabled={pending}>
        {pending ? "Removing…" : "Remove from interest list"}
      </button>
    </form>
  );
}
