"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { openAttendance } from "@/lib/services/phase-5-actions";

export function OpenAttendanceForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState(openAttendance, {});
  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <div className="admin-manage-event-attendance" data-testid="open-attendance-form">
      <form action={formAction} className="admin-manage-event-attendance-actions">
        <input type="hidden" name="eventId" value={eventId} />
        <ConfirmSubmit message="Open check-in for this Event?">Open check-in</ConfirmSubmit>
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
        Check-in opens automatically 30 minutes before start. Use this if it has not opened yet once
        that window begins.
      </p>
    </div>
  );
}
