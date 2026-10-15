"use client";

import { useActionState } from "react";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import {
  deleteLeanParticipant,
  type ParticipantArchiveActionState,
} from "@/lib/services/phase-6-actions";

export function ParticipantDeleteLeanForm({ participantId }: { participantId: string }) {
  const [state, action] = useActionState<ParticipantArchiveActionState, FormData>(
    deleteLeanParticipant,
    {},
  );

  return (
    <form
      action={action}
      className="ops-people-profile-archive"
      data-testid="participant-delete-lean"
    >
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
  );
}
