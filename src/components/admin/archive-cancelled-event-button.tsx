"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import {
  archiveCancelledEventAction,
  type Phase3ActionState,
} from "@/lib/services/phase-3-actions";

export function ArchiveCancelledEventButton({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  // Import the server action here — do not prop-drill through discovery/card trees
  // (prop-drilled actions can lose their Next.js action id).
  const [state, formAction] = useActionState<Phase3ActionState, FormData>(
    archiveCancelledEventAction,
    {},
  );
  const router = useRouter();
  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <form action={formAction} data-testid="archive-cancelled-event">
      <input type="hidden" name="eventId" value={eventId} />
      <ConfirmSubmit
        message={`Archive “${eventName}”? Its registrations and history will be preserved.`}
      >
        Archive event
      </ConfirmSubmit>
      {state.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-green-700">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
