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
      <p className="confirmation-metadata text-sm text-emerald-800" role="status">
        This browser will be remembered for faster bookings.
      </p>
    );
  }
  return (
    <form action={action} className="confirmation-device-card">
      <input type="hidden" name="confirmationToken" value={confirmationToken} />
      <p className="confirmation-section-title">Save my bookings on this device</p>
      <p className="confirmation-body mt-1 text-sm text-[var(--confirmation-muted)]">
        Reopen your upcoming classes without entering your details again.
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="confirmation-pill-button confirmation-pill-button-primary disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="confirmation-pill-button confirmation-pill-button-tertiary"
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
