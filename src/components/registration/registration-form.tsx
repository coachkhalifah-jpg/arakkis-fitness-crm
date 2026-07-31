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
  availability?: string;
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
  seriesMode = false,
}: {
  events: Event[];
  organizations: Organization[];
  participation: Acknowledgment;
  dataUse: Acknowledgment;
  idempotencyKey: string;
  publicSlug?: string;
  seriesMode?: boolean;
}) {
  const [state, action, pending] = useActionState<RegistrationActionState, FormData>(
    publicSlug ? submitSlugRegistration : submitRegistration,
    {},
  );
  if (!participation || !dataUse)
    return (
      <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
        Registration is temporarily unavailable because the acknowledgment content is not
        configured.
      </p>
    );
  return (
    <form
      action={action}
      className="space-y-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft sm:p-8"
    >
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="participationVersionId" value={participation.id} />
      <input type="hidden" name="dataUseVersionId" value={dataUse.id} />
      <fieldset>
        <legend className="text-xl font-semibold tracking-tight">Choose your dates</legend>
        <p className="mt-1 text-sm text-slate-600">
          {seriesMode
            ? "Choose one or more dates in the next two weeks. Each date is reserved separately."
            : "Select one or more sessions. Your contact details are collected once."}
        </p>
        <div className="mt-5 space-y-3">
          {events.map((event) => {
            const full =
              event.active_registration_count >= event.capacity ||
              event.availability === "CLOSED" ||
              event.availability === "CANCELLED";
            return (
              <label
                key={seriesMode ? event.starts_at : (event.id ?? publicSlug ?? event.name)}
                className={`flex min-h-20 gap-3 rounded-2xl border p-4 transition ${full ? "opacity-60" : "cursor-pointer hover:border-brand hover:bg-brand/[0.03]"}`}
              >
                <input
                  type="checkbox"
                  name={
                    seriesMode
                      ? "selectedOccurrenceStartsAt"
                      : publicSlug
                        ? "publicSlug"
                        : "eventIds"
                  }
                  value={seriesMode ? event.starts_at : (publicSlug ?? event.id)}
                  disabled={full}
                  className="mt-1 h-5 w-5 accent-brand"
                />
                <span>
                  <span className="block font-semibold">{event.name}</span>
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
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Your details</h2>
        <p className="mt-1 text-sm text-slate-600">
          A phone number helps us keep your registration and event-day details together.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          First name
          <input
            name="firstName"
            required
            maxLength={100}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>
        <label>
          Last name
          <input
            name="lastName"
            required
            maxLength={100}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>
        <label>
          Mobile phone
          <input
            name="phone"
            required
            maxLength={40}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>
        <label>
          Phone country
          <select
            name="phoneCountry"
            defaultValue="US"
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
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
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>
        <label>
          Primary affiliation
          <select
            name="affiliation"
            defaultValue=""
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
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
        <input
          name="affiliationOther"
          maxLength={200}
          className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </label>
      <label>
        Fitness experience (optional)
        <textarea
          name="fitnessExperience"
          maxLength={1000}
          className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </label>
      <div className="space-y-4 rounded-2xl bg-sand/70 p-5">
        <label className="flex gap-3">
          <input
            name="participationAcknowledged"
            type="checkbox"
            required
            className="mt-1 h-5 w-5 accent-brand"
          />
          <span>{participation.text}</span>
        </label>
        <label className="flex gap-3">
          <input
            name="dataUseAcknowledged"
            type="checkbox"
            required
            className="mt-1 h-5 w-5 accent-brand"
          />
          <span>{dataUse.text}</span>
        </label>
      </div>
      {state.error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">
          {state.error}
        </p>
      ) : null}
      <button
        disabled={pending}
        className="min-h-12 w-full rounded-xl bg-brand px-5 py-3 font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {pending ? "Submitting…" : "Reserve selected dates"}
      </button>
    </form>
  );
}
