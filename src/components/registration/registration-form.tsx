"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { ForgetDevice } from "@/components/registration/forget-device";
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
  rememberedFirstName = null,
}: {
  events: Event[];
  organizations: Organization[];
  participation: Acknowledgment;
  dataUse: Acknowledgment;
  idempotencyKey: string;
  publicSlug?: string;
  seriesMode?: boolean;
  rememberedFirstName?: string | null;
}) {
  const [state, action, pending] = useActionState<RegistrationActionState, FormData>(
    publicSlug ? submitSlugRegistration : submitRegistration,
    {},
  );
  const [useRemembered, setUseRemembered] = useState(Boolean(rememberedFirstName));
  const [showDetails, setShowDetails] = useState(!rememberedFirstName);
  const [selected, setSelected] = useState<string[]>([]);
  const grouped = useMemo(() => {
    const groups = new Map<string, Event[]>();
    for (const event of events) {
      const date = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: event.timezone,
      }).format(new Date(event.starts_at));
      groups.set(date, [...(groups.get(date) ?? []), event]);
    }
    return [...groups.entries()];
  }, [events]);
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
        <div className="mt-5 space-y-6">
          {grouped.map(([date, dateEvents]) => (
            <div key={date}>
              <h3 className="mb-3 text-base font-bold text-ink">{date}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {dateEvents.map((event) => {
                  const full =
                    event.active_registration_count >= event.capacity ||
                    event.availability === "CLOSED" ||
                    event.availability === "CANCELLED";
                  const value = seriesMode
                    ? event.starts_at
                    : (publicSlug ?? event.id ?? event.name);
                  const isSelected = selected.includes(value);
                  return (
                    <label
                      key={value}
                      className={`flex min-h-20 items-center gap-3 rounded-2xl border-2 p-4 transition ${full ? "opacity-50" : isSelected ? "border-brand bg-brand/[0.08] shadow-sm" : "cursor-pointer border-slate-200 hover:border-brand hover:bg-brand/[0.03]"}`}
                    >
                      <input
                        type="checkbox"
                        aria-label={`${event.name}, ${date}, ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: event.timezone }).format(new Date(event.starts_at))}`}
                        name={
                          seriesMode
                            ? "selectedOccurrenceStartsAt"
                            : publicSlug
                              ? "publicSlug"
                              : "eventIds"
                        }
                        value={seriesMode ? event.starts_at : (publicSlug ?? event.id)}
                        disabled={full}
                        checked={isSelected}
                        onChange={(eventChange) =>
                          setSelected((current) =>
                            eventChange.target.checked
                              ? [...current, value]
                              : current.filter((item) => item !== value),
                          )
                        }
                        className="mt-1 h-5 w-5 accent-brand"
                      />
                      <span>
                        <span className="block text-lg font-bold">
                          {new Intl.DateTimeFormat("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            timeZone: event.timezone,
                          }).format(new Date(event.starts_at))}
                        </span>
                        <span className="block text-sm text-slate-600">
                          {event.venue_name} · {event.host_organization_name}
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
            </div>
          ))}
        </div>
        {selected.length ? (
          <div className="mt-5 rounded-2xl bg-ink p-4 text-white" aria-live="polite">
            <p className="font-semibold">
              {selected.length} {selected.length === 1 ? "class" : "classes"} selected
            </p>
            <p className="mt-1 text-sm text-white/75">
              Your choices are saved while you complete the booking.
            </p>
          </div>
        ) : null}
      </fieldset>
      {rememberedFirstName && !showDetails ? (
        <div className="rounded-2xl border border-brand/20 bg-brand/[0.06] p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">
            Welcome back
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">
            Continue as {rememberedFirstName}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Booking with the details saved on this device. Your acknowledgments still apply to this
            booking.
          </p>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-brand underline"
            onClick={() => {
              setUseRemembered(false);
              setShowDetails(true);
            }}
          >
            Not you? Enter details instead
          </button>
          <ForgetDevice />
        </div>
      ) : null}
      <div className={rememberedFirstName && !showDetails ? "hidden" : ""}>
        <h2 className="text-xl font-semibold tracking-tight">Your details</h2>
        <p className="mt-1 text-sm text-slate-600">
          A phone number helps us keep your registration and event-day details together.
        </p>
      </div>
      <fieldset
        disabled={Boolean(rememberedFirstName && !showDetails)}
        className="grid gap-4 sm:grid-cols-2"
      >
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
      </fieldset>
      <fieldset disabled={Boolean(rememberedFirstName && !showDetails)} className="space-y-4">
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
      </fieldset>
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
        {pending ? "Booking…" : useRemembered ? `Continue as ${rememberedFirstName}` : "Book Class"}
      </button>
      {useRemembered ? <input type="hidden" name="continueAsRemembered" value="true" /> : null}
    </form>
  );
}
