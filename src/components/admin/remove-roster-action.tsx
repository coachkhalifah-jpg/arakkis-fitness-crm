"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { removeRegistrationFromRoster } from "@/lib/services/phase-5-actions";

export function RemoveRosterAction({
  eventId,
  eventName,
  registrationId,
  participantName,
}: {
  eventId: string;
  eventName: string;
  registrationId: string;
  participantName: string;
}) {
  // Import the server action in this module — do not pass it through discovery/card
  // prop trees. Prop-drilled actions can lose their Next.js action id and 500 with
  // "Failed to find Server Action".
  const [state, formAction] = useActionState(removeRegistrationFromRoster, {});
  const router = useRouter();
  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);
  return (
    <details className="event-roster-secondary-action">
      <summary tabIndex={0} aria-label={`More actions for ${participantName}`}>
        <span>•••</span>
      </summary>
      <form action={formAction} className="event-roster-remove-form">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="registrationId" value={registrationId} />
        <ConfirmSubmit
          variant="tertiary"
          message={`Remove ${participantName} from ${eventName}'s roster? Their participant identity and history will be preserved.`}
        >
          Remove from roster
        </ConfirmSubmit>
      </form>
      {state.error ? (
        <p role="alert" className="event-roster-action-message event-roster-action-error">
          {state.error} {state.errorAction}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="event-roster-action-message">
          Removed from roster.
        </p>
      ) : null}
    </details>
  );
}
