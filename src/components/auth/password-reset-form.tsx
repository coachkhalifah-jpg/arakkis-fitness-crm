"use client";

import { useActionState } from "react";
import { updatePassword, type AuthActionState } from "@/lib/auth/session-actions";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/password-input";

const initialState: AuthActionState = {};

export function PasswordResetForm() {
  const [state, action, pending] = useActionState(updatePassword, initialState);
  return (
    <form action={action} className="ops-auth-form">
      <PasswordInput
        id="password"
        name="password"
        autoComplete="new-password"
        required
        minLength={8}
        label="New password"
      />
      <PasswordInput
        id="confirmation"
        name="confirmation"
        autoComplete="new-password"
        required
        minLength={8}
        label="Confirm password"
      />
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
