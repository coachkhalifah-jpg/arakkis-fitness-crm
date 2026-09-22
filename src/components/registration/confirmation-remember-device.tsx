"use client";

import { useActionState } from "react";
import { rememberDeviceOnConfirmation } from "@/lib/registration/actions";

type ConfirmationRememberDeviceProps = {
  token: string;
  correlationId: string;
};

export function ConfirmationRememberDevice({
  token,
  correlationId,
}: ConfirmationRememberDeviceProps) {
  const [state, action, pending] = useActionState(rememberDeviceOnConfirmation, {});

  return (
    <form action={action} className="confirmation-remember-prompt">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="correlationId" value={correlationId} />
      <p className="confirmation-access-alert-title">Keep your classes on this device</p>
      <p>
        Confirmation links expire in 24 hours. Remember this device so you can return and see all
        your upcoming classes without saving the link.
      </p>
      <label className="confirmation-remember-label flex min-h-12 items-start gap-3">
        <input
          id="confirmationRememberDevice"
          name="rememberDevice"
          type="checkbox"
          defaultChecked
          aria-describedby="confirmationRememberDevice-description"
          className="mt-1 h-5 w-5 shrink-0 accent-brand"
        />
        <span>
          <span className="block font-semibold">Remember this device</span>
          <span
            id="confirmationRememberDevice-description"
            className="mt-1 block text-sm leading-6 text-[var(--confirmation-muted)]"
          >
            We’ll securely remember this browser so you can view and manage your classes here. You
            can forget this device anytime. This is not an account login.
          </span>
        </span>
      </label>
      {state.error ? (
        <p className="confirmation-remember-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        className="confirmation-pill-button confirmation-pill-button-primary confirmation-action-button"
        disabled={pending}
      >
        {pending ? "Saving…" : "Save on this device"}
      </button>
    </form>
  );
}
