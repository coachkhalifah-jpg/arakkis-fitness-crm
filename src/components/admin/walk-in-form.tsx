"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createWalkIn } from "@/lib/services/phase-5-actions";
import { SubmitButton } from "@/components/admin/submit-button";

export function WalkInForm({
  eventId,
  participationVersionId,
  dataUseVersionId,
}: {
  eventId: string;
  participationVersionId: string;
  dataUseVersionId: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState(createWalkIn, {});
  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);
  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="walk-in-form">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="participationVersionId" value={participationVersionId} />
      <input type="hidden" name="dataUseVersionId" value={dataUseVersionId} />
      <label>
        First name
        <input name="firstName" required className="mt-1 w-full rounded border p-2" />
      </label>
      <label>
        Last name
        <input name="lastName" required className="mt-1 w-full rounded border p-2" />
      </label>
      <label>
        Phone
        <input name="phone" required className="mt-1 w-full rounded border p-2" />
      </label>
      <label>
        Country
        <input
          name="phoneCountry"
          defaultValue="US"
          required
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <label>
        Email
        <input name="email" type="email" className="mt-1 w-full rounded border p-2" />
      </label>
      <label>
        Affiliation organization ID
        <input name="affiliation" className="mt-1 w-full rounded border p-2" />
      </label>
      <label className="sm:col-span-2">
        System Admin override reason (only used when authorized and full)
        <input name="overrideReason" className="mt-1 w-full rounded border p-2" />
      </label>
      <SubmitButton>Add Walk-In &amp; Check In</SubmitButton>
      {state.error ? (
        <div role="alert" className="sm:col-span-2 text-sm text-red-700">
          <p>{state.error}</p>
          {state.errorAction ? <p className="mt-1 font-medium">Next: {state.errorAction}</p> : null}
        </div>
      ) : null}
      {state.success ? (
        <p role="status" className="sm:col-span-2 text-sm text-emerald-700">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
