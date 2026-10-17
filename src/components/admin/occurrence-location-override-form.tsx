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
      className="mt-4 mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4"
      data-testid="occurrence-location-override"
    >
      <h3 className="font-semibold text-amber-950">Occurrence location</h3>
      <p className="mt-1 text-sm text-amber-900">
        This changes this occurrence only; the series and other dates keep their locations.
      </p>
      <form action={action} className="mt-3 flex flex-wrap gap-2">
        <input type="hidden" name="eventId" value={eventId} />
        <VenueSelect
          name="locationOverrideVenueId"
          defaultValue={defaultVenueId}
          className="rounded border p-2 text-sm"
          organizationId={organizationId}
          organizationName={organizationName}
          venues={venues}
          required
          aria-label="Occurrence venue"
        />
        <input
          name="note"
          placeholder="Optional location note"
          className="rounded border p-2 text-sm"
          maxLength={200}
          aria-label="Optional location note"
        />
        <SubmitButton className="admin-manage-event-orange-action rounded bg-brand px-3 py-2 text-sm font-semibold text-white">
          Save occurrence location
        </SubmitButton>
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
