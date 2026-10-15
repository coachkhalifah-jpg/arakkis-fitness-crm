"use client";

import { useActionState, useState } from "react";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { PeopleDestructiveActionSheet } from "@/components/admin/people-destructive-action-sheet";
import { deleteLeanEvent, type Phase3ActionState } from "@/lib/services/phase-3-actions";

export function EventDeleteLeanForm({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<Phase3ActionState, FormData>(deleteLeanEvent, {});

  return (
    <div className="ops-people-profile-destructive" data-testid="event-delete-lean">
      <button
        type="button"
        className="admin-series-action admin-series-action-subordinate ops-people-profile-destructive-trigger"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        Delete permanently
      </button>
      <PeopleDestructiveActionSheet
        open={open}
        onClose={() => setOpen(false)}
        kicker="Events"
        title="Delete permanently."
      >
        <p>
          Only for lean junk/test Events with no registrations or durable history. Prefer Cancel +
          Archive when history exists. This cannot be undone.
        </p>
        <form action={action} className="ops-people-profile-archive">
          <input type="hidden" name="eventId" value={eventId} />
          <label className="ops-people-profile-archive-reason">
            <span className="ops-label">Reason for permanent delete</span>
            <input
              name="reason"
              required
              maxLength={500}
              placeholder="Why permanently delete this lean event?"
              aria-label="Reason for permanent delete"
            />
          </label>
          <ConfirmSubmit
            variant="destructive"
            message="Permanently delete this event? This only works when it has no registrations or durable history. This cannot be undone."
          >
            Delete permanently
          </ConfirmSubmit>
          {state.error ? (
            <p role="alert" className="ops-people-profile-message is-error">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p role="status" className="ops-people-profile-message">
              {state.success}
            </p>
          ) : null}
        </form>
      </PeopleDestructiveActionSheet>
    </div>
  );
}
