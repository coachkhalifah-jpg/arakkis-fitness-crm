"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AuthActionState } from "@/lib/auth/session-actions";
import { Button } from "@/components/ui/button";

const initialState: AuthActionState = {};

export function PasswordResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);
  return (
    <form action={action} className="ops-auth-form">
      <label htmlFor="email">
        Email
        <input id="email" name="email" type="email" autoComplete="email" required />
      </label>
      {state.error ? (
        <p className="ops-auth-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p role="status">{state.success}</p> : null}
      <Button className="button ops-auth-submit" disabled={pending} type="submit">
        {pending ? "Sending…" : "Send reset link ↗"}
      </Button>
    </form>
  );
}
