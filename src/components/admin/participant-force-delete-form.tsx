"use client";

import { useActionState, useState } from "react";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { PeopleDestructiveActionSheet } from "@/components/admin/people-destructive-action-sheet";
import {
  forceDeleteParticipant,
  type ParticipantArchiveActionState,
} from "@/lib/services/phase-6-actions";

export function ParticipantForceDeleteForm({ participantId }: { participantId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ParticipantArchiveActionState, FormData>(
    forceDeleteParticipant,
    {},
  );

  return (
    <div className="ops-people-profile-destructive" data-testid="participant-force-delete">
      <button
        type="button"
        className="admin-series-action admin-series-action-subordinate ops-people-profile-destructive-trigger"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        Force delete with history
      </button>
      <PeopleDestructiveActionSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Force delete with history."
      >
        <p>
          Permanently wipes this person and all related bookings, notes, follow-ups, and legal
          evidence. Use only for test/junk cleanup when archive is not enough. Prefer archive for
          real people. This cannot be undone.
        </p>
        <form action={action} className="ops-people-profile-archive">
          <input type="hidden" name="participantId" value={participantId} />
          <label className="ops-people-profile-archive-reason">
            <span className="ops-label">Reason for force delete</span>
            <input
              name="reason"
              required
              maxLength={500}
              placeholder="Why permanently wipe this person and all history?"
              aria-label="Reason for force delete"
            />
          </label>
          <ConfirmSubmit
            variant="destructive"
            message="Force delete this person and ALL bookings, notes, follow-ups, and legal history? This cannot be undone. Prefer Remove from People (archive) when you only need them out of the directory."
          >
            Force delete with history
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
