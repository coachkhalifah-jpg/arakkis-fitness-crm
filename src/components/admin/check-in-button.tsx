"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { markAttendance } from "@/lib/services/phase-5-actions";

function CheckInSubmitButton({
  className,
  children,
  pendingLabel = "Working…",
}: {
  className?: string;
  children: ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function CheckInButton({
  eventId,
  registrationId,
  status,
  className,
  children,
  pendingLabel,
}: {
  eventId: string;
  registrationId: string;
  status: "ATTENDED" | "NOT_RECORDED";
  className?: string;
  children: ReactNode;
  pendingLabel?: string;
}) {
  // Import the server action here — do not prop-drill through discovery/card trees
  // (prop-drilled actions can lose their Next.js action id).
  const [state, formAction] = useActionState(markAttendance, {});
  const router = useRouter();
  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="registrationId" value={registrationId} />
      <input type="hidden" name="status" value={status} />
      <CheckInSubmitButton className={className} pendingLabel={pendingLabel}>
        {children}
      </CheckInSubmitButton>
      {state.error ? (
        <div role="alert" className="event-roster-action-message event-roster-action-error">
          <p>{state.error}</p>
          {state.errorAction ? <p className="mt-1 font-medium">Next: {state.errorAction}</p> : null}
        </div>
      ) : null}
    </form>
  );
}
