"use client";

import { useActionState } from "react";
import { updatePassword, type AuthActionState } from "@/lib/auth/session-actions";
import { Button } from "@/components/ui/button";

const initialState: AuthActionState = {};

export function PasswordResetForm() {
  const [state, action, pending] = useActionState(updatePassword, initialState);
  return (
    <form action={action} className="ops-auth-form">
      <label htmlFor="password">
        New password
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </label>
      <label htmlFor="confirmation">
        Confirm password
        <input
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </label>
      {state.error ? (
        <p className="ops-auth-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button className="button ops-auth-submit" disabled={pending} type="submit">
        {pending ? "Updating…" : "Update password ↗"}
      </Button>
    </form>
  );
}
