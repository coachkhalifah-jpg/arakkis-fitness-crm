"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { finalizeAttendance } from "@/lib/services/phase-5-actions";

export function FinalizeAttendanceForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState(finalizeAttendance, {});
  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <div className="admin-manage-event-attendance" data-testid="finalize-attendance-form">
      <form action={formAction} className="admin-manage-event-attendance-actions">
        <input type="hidden" name="eventId" value={eventId} />
        <ConfirmSubmit message="Finalize attendance for this Event? Unmarked eligible registrations will be recorded as no-shows.">
          Finalize Attendance
        </ConfirmSubmit>
      </form>
      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {state.error}
          {state.errorAction ? (
            <span className="mt-1 block font-medium">Next: {state.errorAction}</span>
          ) : null}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="mt-3 text-sm text-emerald-700">
          {state.success}
        </p>
      ) : null}
      <p className="mt-3 text-sm text-slate-600">
        Unmarked eligible registrations will be recorded as no-shows.
      </p>
    </div>
  );
}
