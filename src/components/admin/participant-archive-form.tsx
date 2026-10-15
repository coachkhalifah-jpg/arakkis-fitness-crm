"use client";

import { useActionState } from "react";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import {
  archiveParticipant,
  type ParticipantArchiveActionState,
} from "@/lib/services/phase-6-actions";

export function ParticipantArchiveForm({ participantId }: { participantId: string }) {
  const [state, action] = useActionState<ParticipantArchiveActionState, FormData>(
    archiveParticipant,
    {},
  );

  return (
    <form action={action} className="ops-people-profile-archive" data-testid="participant-archive">
      <input type="hidden" name="participantId" value={participantId} />
      <label className="ops-people-profile-archive-reason">
        <span className="ops-label">Reason for removal</span>
        <input
          name="reason"
          required
          maxLength={500}
          placeholder="Why remove this person from People?"
          aria-label="Reason for removal"
        />
      </label>
      <ConfirmSubmit
        variant="secondary"
        message="Remove this person from People? History is preserved; they leave the ACTIVE directory. Cancel any upcoming bookings first."
      >
        Remove from People
      </ConfirmSubmit>
      {state.error ? (
        <p role="alert" className="ops-people-profile-message is-error">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
