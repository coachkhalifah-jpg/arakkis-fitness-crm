"use client";

import { useActionState, useState } from "react";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { PeopleDestructiveActionSheet } from "@/components/admin/people-destructive-action-sheet";
import {
  deleteLeanParticipant,
  type ParticipantArchiveActionState,
} from "@/lib/services/phase-6-actions";

export function ParticipantDeleteLeanForm({ participantId }: { participantId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ParticipantArchiveActionState, FormData>(
    deleteLeanParticipant,
    {},
  );

  return (
    <div className="ops-people-profile-destructive" data-testid="participant-delete-lean">
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
        title="Delete permanently."
      >
        <p>
          Only for lean test/junk rows with no bookings, notes, follow-ups, or legal history. Prefer
          Remove from People (archive) when history exists. This cannot be undone.
        </p>
        <form action={action} className="ops-people-profile-archive">
          <input type="hidden" name="participantId" value={participantId} />
          <label className="ops-people-profile-archive-reason">
            <span className="ops-label">Reason for permanent delete</span>
            <input
              name="reason"
              required
              maxLength={500}
              placeholder="Why permanently delete this lean record?"
              aria-label="Reason for permanent delete"
            />
          </label>
          <ConfirmSubmit
            variant="destructive"
            message="Permanently delete this person? This only works when they have no bookings, notes, or follow-up history. This cannot be undone."
          >
            Delete permanently
          </ConfirmSubmit>
          {state.error ? (
            <p role="alert" className="ops-people-profile-message is-error">
              {state.error}
            </p>
          ) : null}
        </form>
      </PeopleDestructiveActionSheet>
    </div>
  );
}
