"use client";

import { useActionState, useState } from "react";
import { rememberDeviceAction, type DeviceActionState } from "@/lib/registration/device-actions";

export function RememberDevice({ confirmationToken }: { confirmationToken: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [state, action, pending] = useActionState<DeviceActionState, FormData>(
    rememberDeviceAction,
    {},
  );
  if (dismissed) return null;
  if (state.success) {
    return (
      <p className="text-sm text-emerald-800" role="status">
        This browser will be remembered for faster bookings.
      </p>
    );
  }
  return (
    <form action={action} className="confirmation-device-card">
      <input type="hidden" name="confirmationToken" value={confirmationToken} />
      <p className="font-semibold">Save my bookings on this device</p>
      <p className="mt-1 text-sm leading-6 text-[var(--confirmation-muted)]">
        Reopen your upcoming classes without entering your details again.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-xl bg-brand px-4 py-2 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save my bookings"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="min-h-11 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--confirmation-muted)] underline underline-offset-2 hover:text-[var(--confirmation-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Not now
        </button>
      </div>
      {state.error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
