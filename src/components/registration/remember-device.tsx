"use client";

import { useActionState } from "react";
import { rememberDeviceAction, type DeviceActionState } from "@/lib/registration/device-actions";

export function RememberDevice({ confirmationToken }: { confirmationToken: string }) {
  const [state, action, pending] = useActionState<DeviceActionState, FormData>(
    rememberDeviceAction,
    {},
  );
  if (state.success) {
    return (
      <p className="text-sm text-emerald-800" role="status">
        This browser will be remembered for faster bookings.
      </p>
    );
  }
  return (
    <form action={action} className="rounded-2xl border border-brand/20 bg-brand/[0.06] p-5">
      <input type="hidden" name="confirmationToken" value={confirmationToken} />
      <p className="font-semibold text-ink">Make future bookings faster on this device</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        We can securely remember this browser so you won’t need to enter your details every time.
        This is optional, not advertising, and does not create an account.
      </p>
      <button
        disabled={pending}
        className="mt-4 rounded-xl bg-brand px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Remember this device"}
      </button>
      {state.error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
