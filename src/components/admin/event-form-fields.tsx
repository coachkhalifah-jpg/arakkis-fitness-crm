"use client";

import { useMemo, useRef, useState } from "react";

type Organization = { id: string; name: string };
type Venue = { id: string; name: string; organization_id: string; timezone: string };

export function OrganizationVenueFields({
  organizations,
  venues,
  organizationId = "",
  venueId = "",
}: {
  organizations: Organization[];
  venues: Venue[];
  organizationId?: string;
  venueId?: string;
}) {
  const [selectedOrganization, setSelectedOrganization] = useState(organizationId);
  const venueRef = useRef<HTMLSelectElement>(null);
  const availableVenues = useMemo(
    () => venues.filter((venue) => venue.organization_id === selectedOrganization),
    [selectedOrganization, venues],
  );

  return (
    <>
      <label>
        Organization
        <select
          name="hostOrganizationId"
          required
          defaultValue={organizationId}
          className="mt-1 w-full rounded border p-2"
          onChange={(event) => {
            const next = event.currentTarget.value;
            setSelectedOrganization(next);
            if (
              venueRef.current &&
              !venues.some(
                (venue) => venue.id === venueRef.current?.value && venue.organization_id === next,
              )
            ) {
              venueRef.current.value = "";
            }
          }}
        >
          <option value="">Select organization</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Venue
        <select
          ref={venueRef}
          name="venueId"
          required
          defaultValue={venueId}
          className="mt-1 w-full rounded border p-2"
        >
          <option value="">
            {selectedOrganization && availableVenues.length === 0
              ? "No active venues for this organization"
              : "Select venue"}
          </option>
          {availableVenues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name} ({venue.timezone})
            </option>
          ))}
        </select>
        {selectedOrganization && availableVenues.length === 0 ? (
          <span className="mt-1 block text-xs text-slate-600">
            No active venues are available. Create one in Venue management.
          </span>
        ) : null}
      </label>
    </>
  );
}

function addMinutes(value: string, minutes: number) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() + minutes);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventTimingFields({
  startValue = "",
  endValue = "",
  deadlineValue = "",
}: {
  startValue?: string;
  endValue?: string;
  deadlineValue?: string;
}) {
  const [start, setStart] = useState(startValue);
  const [duration, setDuration] = useState<number | null>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const deadlineRef = useRef<HTMLInputElement>(null);
  const deadlineTouched = useRef(Boolean(deadlineValue));
  const setStartValue = (value: string) => {
    setStart(value);
    if (duration !== null && endRef.current) endRef.current.value = addMinutes(value, duration);
    if (!deadlineTouched.current && deadlineRef.current) deadlineRef.current.value = value;
  };
  return (
    <>
      <label>
        Local start
        <input
          name="startLocal"
          type="datetime-local"
          required
          defaultValue={startValue}
          className="mt-1 w-full rounded border p-2"
          onChange={(event) => setStartValue(event.currentTarget.value)}
        />
      </label>
      <label>
        Local end
        <input
          ref={endRef}
          name="endLocal"
          type="datetime-local"
          required
          defaultValue={endValue}
          className="mt-1 w-full rounded border p-2"
          onChange={() => setDuration(null)}
        />
      </label>
      <div className="sm:col-span-2" aria-label="Duration shortcuts">
        <span className="text-sm font-medium">Quick duration</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {[60, 45, 30].map((minutes) => (
            <button
              key={minutes}
              type="button"
              disabled={!start}
              aria-pressed={duration === minutes}
              className="rounded border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-brand aria-pressed:bg-brand/10"
              onClick={() => {
                setDuration(minutes);
                if (endRef.current) endRef.current.value = addMinutes(start, minutes);
              }}
            >
              {minutes} min
            </button>
          ))}
        </div>
      </div>
      <label>
        Registration deadline
        <input
          ref={deadlineRef}
          name="registrationDeadlineLocal"
          type="datetime-local"
          required
          defaultValue={deadlineValue}
          className="mt-1 w-full rounded border p-2"
          onChange={() => {
            deadlineTouched.current = true;
          }}
        />
        <span className="mt-1 block text-xs text-slate-600">
          Defaults to the event start until you change it.
        </span>
      </label>
    </>
  );
}
