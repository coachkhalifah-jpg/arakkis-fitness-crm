"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { Alert } from "@/components/ui/alert";
import { reopenAttendance } from "@/lib/services/phase-5-actions";

export function ReopenAttendanceForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState(reopenAttendance, {});
  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <div className="admin-manage-event-attendance" data-testid="reopen-attendance-form">
      <div className="admin-manage-event-attendance-actions flex flex-wrap gap-2">
        <form action={formAction} className="flex gap-2">
          <input type="hidden" name="eventId" value={eventId} />
          <input
            name="reason"
            required
            placeholder="Reopen reason"
            className="rounded border p-2 text-sm"
          />
          <ConfirmSubmit message="Reopen attendance for correction?">Reopen</ConfirmSubmit>
        </form>
      </div>
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
      <Alert className="mt-4">
        Attendance is finalized. Authorized Host Admins may correct individual results for this
        event with a reason. Only System Admins may reopen the entire event.
      </Alert>
    </div>
  );
}
