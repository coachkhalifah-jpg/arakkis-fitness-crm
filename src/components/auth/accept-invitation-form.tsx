"use client";

import { useActionState } from "react";
import { acceptInvitation, type AuthActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitation, {} as AuthActionState);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="displayName">
          Name
        </label>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          id="displayName"
          name="displayName"
          autoComplete="name"
          required
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="email">
          Invited email
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
          Create password
        </label>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          id="password"
          name="password"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </div>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-green-700" role="status">
          {state.success}
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        {pending ? "Accepting…" : "Accept invitation"}
      </Button>
    </form>
  );
}
