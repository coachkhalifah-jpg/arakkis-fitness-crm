"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  pausePhase7EventForm,
  resumePhase7EventForm,
  type Phase7ActionState,
} from "@/lib/services/phase-7-actions";

export function EventRegistrationPauseControls({
  eventId,
  paused,
}: {
  eventId: string;
  paused: boolean;
}) {
  const router = useRouter();
  const action = paused ? resumePhase7EventForm : pausePhase7EventForm;
  const [state, formAction, pending] = useActionState<Phase7ActionState, FormData>(action, {});

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <div
      className="admin-manage-event-secondary-actions"
      data-testid="event-registration-pause-controls"
    >
      <form action={formAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <Button type="submit" disabled={pending}>
          {pending
            ? paused
              ? "Resuming…"
              : "Pausing…"
            : paused
              ? "Resume registration"
              : "Pause registration"}
        </Button>
      </form>
      {state.error ? (
        <p role="alert" className="admin-manage-event-share-message is-error">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="admin-manage-event-share-message is-success">
          {state.success}
        </p>
      ) : null}
    </div>
  );
}
