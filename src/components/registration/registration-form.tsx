"use client";

import { useActionState } from "react";
import {
  submitRegistration,
  submitSlugRegistration,
  type RegistrationActionState,
} from "@/lib/registration/actions";

type Event = {
  id?: string;
  name: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  venue_name: string;
  host_organization_name: string;
  active_registration_count: number;
  capacity: number;
  visibility: string;
};
type Organization = { id: string; name: string };
type Acknowledgment = { id: string; text: string } | null;

export function RegistrationForm({
  events,
  organizations,
  participation,
  dataUse,
  idempotencyKey,
  publicSlug,
}: {
  events: Event[];
  organizations: Organization[];
  participation: Acknowledgment;
  dataUse: Acknowledgment;
  idempotencyKey: string;
  publicSlug?: string;
}) {
  const [state, action, pending] = useActionState<RegistrationActionState, FormData>(
    publicSlug ? submitSlugRegistration : submitRegistration,
    {},
  );
  if (!participation || !dataUse)
    return (
      <p className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-900">
        Registration is temporarily unavailable because the acknowledgment content is not
        configured.
      </p>
    );
  return (
    <form action={action} className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="participationVersionId" value={participation.id} />
      <input type="hidden" name="dataUseVersionId" value={dataUse.id} />
      <fieldset>
        <legend className="text-lg font-semibold">Choose one or more dates</legend>
        <div className="mt-3 space-y-3">
          {events.map((event) => {
            const full = event.active_registration_count >= event.capacity;
            return (
              <label
                key={event.id ?? publicSlug ?? event.name}
                className={`flex gap-3 rounded border p-3 ${full ? "opacity-60" : "cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  name={publicSlug ? "publicSlug" : "eventIds"}
                  value={publicSlug ?? event.id}
                  disabled={full}
                  className="mt-1 h-5 w-5"
                />
                <span>
                  <span className="block font-medium">{event.name}</span>
                  <span className="block text-sm text-slate-600">
                    {new Intl.DateTimeFormat("en-US", {
                      dateStyle: "full",
                      timeStyle: "short",
                      timeZone: event.timezone,
                    }).format(new Date(event.starts_at))}{" "}
                    · {event.venue_name} · {event.host_organization_name}
                  </span>
                  <span className="block text-sm text-slate-600">
                    {full
                      ? "Full"
                      : `${event.capacity - event.active_registration_count} spots available`}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          First name
          <input
            name="firstName"
            required
            maxLength={100}
            className="mt-1 w-full rounded border p-2"
          />
        </label>
        <label>
          Last name
          <input
            name="lastName"
            required
            maxLength={100}
            className="mt-1 w-full rounded border p-2"
          />
        </label>
        <label>
          Mobile phone
          <input name="phone" required maxLength={40} className="mt-1 w-full rounded border p-2" />
        </label>
        <label>
          Phone country
          <select name="phoneCountry" defaultValue="US" className="mt-1 w-full rounded border p-2">
            {["US", "CA", "GB", "AU", "IN"].map((country) => (
              <option key={country}>{country}</option>
            ))}
          </select>
        </label>
        <label>
          Email (optional)
          <input
            name="email"
            type="email"
            maxLength={254}
            className="mt-1 w-full rounded border p-2"
          />
        </label>
        <label>
          Primary affiliation
          <select name="affiliation" defaultValue="" className="mt-1 w-full rounded border p-2">
            <option value="">Other / No affiliation</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Other affiliation (optional)
        <input name="affiliationOther" maxLength={200} className="mt-1 w-full rounded border p-2" />
      </label>
      <label>
        Fitness experience (optional)
        <textarea
          name="fitnessExperience"
          maxLength={1000}
          className="mt-1 min-h-20 w-full rounded border p-2"
        />
      </label>
      <div className="space-y-3 rounded border bg-slate-50 p-4">
        <label className="flex gap-3">
          <input
            name="participationAcknowledged"
            type="checkbox"
            required
            className="mt-1 h-5 w-5"
          />
          <span>{participation.text}</span>
        </label>
        <label className="flex gap-3">
          <input name="dataUseAcknowledged" type="checkbox" required className="mt-1 h-5 w-5" />
          <span>{dataUse.text}</span>
        </label>
      </div>
      {state.error ? (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-800">
          {state.error}
        </p>
      ) : null}
      <button
        disabled={pending}
        className="rounded-md bg-brand px-5 py-3 font-medium text-white disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Reserve selected dates"}
      </button>
    </form>
  );
}
