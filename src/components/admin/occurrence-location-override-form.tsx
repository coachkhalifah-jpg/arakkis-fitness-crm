"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { VenueSelect } from "@/components/admin/event-form-fields";
import { SubmitButton } from "@/components/admin/submit-button";
import {
  setOccurrenceLocationOverrideAction,
  type Phase3ActionState,
} from "@/lib/services/phase-3-actions";

type VenueOption = {
  id: string;
  name: string;
  timezone: string;
  organization_id: string | null;
};

export function OccurrenceLocationOverrideForm({
  eventId,
  organizationId,
  organizationName,
  defaultVenueId,
  venues,
}: {
  eventId: string;
  organizationId: string;
  organizationName?: string;
  defaultVenueId: string;
  venues: VenueOption[];
}) {
  const router = useRouter();
  const [state, action] = useActionState<Phase3ActionState, FormData>(
    setOccurrenceLocationOverrideAction,
    {},
  );

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <div
      className="mt-6 border-t border-slate-200 pt-4"
      data-testid="occurrence-location-override"
    >
      <h3 className="text-sm font-semibold text-slate-900">Occurrence location</h3>
      <p className="mt-1 text-sm text-slate-600">
        This changes this occurrence only; the series and other dates keep their locations.
      </p>
      <form action={action} className="mt-3 grid gap-3">
        <input type="hidden" name="eventId" value={eventId} />
        <label>
          Occurrence venue
          <VenueSelect
            name="locationOverrideVenueId"
            defaultValue={defaultVenueId}
            className="mt-1 w-full rounded border p-2"
            organizationId={organizationId}
            organizationName={organizationName}
            venues={venues}
            required
            aria-label="Occurrence venue"
          />
        </label>
        <label>
          Optional location note
          <input
            name="note"
            placeholder="Optional location note"
            className="mt-1 w-full rounded border p-2"
            maxLength={200}
            aria-label="Optional location note"
          />
        </label>
        <div>
          <SubmitButton>Save occurrence location</SubmitButton>
        </div>
      </form>
      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="mt-2 text-sm text-green-700">
          {state.success}
        </p>
      ) : null}
    </div>
  );
}
