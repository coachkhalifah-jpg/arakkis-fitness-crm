"use client";

import { useActionState } from "react";
import { signIn, type AuthActionState } from "@/lib/auth/session-actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const initialState: AuthActionState = {};

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, initialState);
  return (
    <form action={action} className="ops-auth-form">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email">
        Email or username
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@arakkis.test"
        />
      </label>
      <label htmlFor="password">
        Password
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Enter your password"
        />
      </label>
      <Link href="/admin/reset-password" className="ops-auth-return">
        Forgot password?
      </Link>
      {state.error ? (
        <p className="ops-auth-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button className="button ops-auth-submit" disabled={pending} type="submit">
        {pending ? "Opening workspace…" : "Sign in ↗"}
      </Button>
    </form>
  );
}
