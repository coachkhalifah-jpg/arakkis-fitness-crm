"use client";

import { useActionState } from "react";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import {
  forceDeleteParticipant,
  type ParticipantArchiveActionState,
} from "@/lib/services/phase-6-actions";

export function ParticipantForceDeleteForm({ participantId }: { participantId: string }) {
  const [state, action] = useActionState<ParticipantArchiveActionState, FormData>(
    forceDeleteParticipant,
    {},
  );

  return (
    <form
      action={action}
      className="ops-people-profile-archive"
      data-testid="participant-force-delete"
    >
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
  );
}
