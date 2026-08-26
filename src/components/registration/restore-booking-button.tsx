"use client";

import { useActionState } from "react";
import { restoreBookingAction } from "@/lib/registration/booking-actions";
import type { BookingActionError } from "@/lib/registration/booking-management";

export function RestoreBookingButton({
  registrationId,
  accessToken,
}: {
  registrationId: string;
  accessToken?: string;
}) {
  const [state, action, pending] = useActionState<BookingActionError | undefined, FormData>(
    restoreBookingAction,
    undefined,
  );
  return (
    <div>
      <form action={action}>
        <input type="hidden" name="registrationId" value={registrationId} />
        {accessToken ? <input type="hidden" name="accessToken" value={accessToken} /> : null}
        <button
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          type="submit"
          disabled={pending}
        >
          {pending ? "Restoring…" : "Restore Booking"}
        </button>
      </form>
      {state?.error ? (
        <p className="mt-2 max-w-xs text-sm font-medium text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
