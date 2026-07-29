"use client";

import { useActionState } from "react";
import { signIn, type AuthActionState } from "@/lib/auth/session-actions";
import { Button } from "@/components/ui/button";

const initialState: AuthActionState = {};

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, initialState);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
