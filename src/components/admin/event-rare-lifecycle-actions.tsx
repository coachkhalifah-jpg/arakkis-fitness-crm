"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import {
  archiveCancelledEventAction,
  cancelEventAction,
  copyEventAction,
  type Phase3ActionState,
} from "@/lib/services/phase-3-actions";

function ActionFeedback({ state }: { state: Phase3ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="text-sm text-green-700">
        {state.success}
        {state.createdEventId ? (
          <span className="mt-2 block">
            <Link className="underline" href={`/admin/events/${state.createdEventId}`}>
              Open the created event
            </Link>
          </span>
        ) : null}
      </p>
    );
  }
  return null;
}

export function EventRareLifecycleActions({
  eventId,
  status,
  archivedAt,
}: {
  eventId: string;
  status: string;
  archivedAt: string | null;
}) {
  const router = useRouter();
  const [copyState, copyAction] = useActionState<Phase3ActionState, FormData>(copyEventAction, {});
  const [cancelState, cancelAction] = useActionState<Phase3ActionState, FormData>(
    cancelEventAction,
    {},
  );
  const [archiveState, archiveAction] = useActionState<Phase3ActionState, FormData>(
    archiveCancelledEventAction,
    {},
  );

  useEffect(() => {
    if (cancelState.success || archiveState.success) router.refresh();
  }, [archiveState.success, cancelState.success, router]);

  return (
    <>
      {status !== "CANCELLED" ? (
        <form action={copyAction} data-testid="event-copy-action">
          <input type="hidden" name="eventId" value={eventId} />
          <ConfirmSubmit message="Copy this event into a new draft? Registrations and history will not be copied.">
            Copy event
          </ConfirmSubmit>
          <ActionFeedback state={copyState} />
        </form>
      ) : null}
      {status !== "CANCELLED" && status !== "COMPLETED" ? (
        <form action={cancelAction} data-testid="event-cancel-action">
          <input type="hidden" name="eventId" value={eventId} />
          <ConfirmSubmit
            message="Cancel this event permanently? It cannot be restored."
            variant="destructive"
          >
            Cancel event
          </ConfirmSubmit>
          <ActionFeedback state={cancelState} />
        </form>
      ) : null}
      {status === "CANCELLED" && !archivedAt ? (
        <form action={archiveAction} data-testid="event-archive-action">
          <input type="hidden" name="eventId" value={eventId} />
          <ConfirmSubmit message="Archive this cancelled event? Registrations and history will be preserved.">
            Archive event
          </ConfirmSubmit>
          <ActionFeedback state={archiveState} />
        </form>
      ) : null}
    </>
  );
}
