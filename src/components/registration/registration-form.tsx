"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { ForgetDevice } from "@/components/registration/forget-device";
import {
  submitRegistration,
  submitSlugRegistration,
  type RegistrationField,
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
  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    phoneCountry: "US",
    email: "",
    affiliation: "",
    fitnessExperience: "",
  });
  const [acknowledgments, setAcknowledgments] = useState({
    participationAcknowledged: false,
    dataUseAcknowledged: false,
  });
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
  useEffect(() => {
    if (!state.focusField) return;
    const focusTarget =
      document.getElementById(state.focusField) ??
      document.querySelector<HTMLInputElement>(`[name="${state.focusField}"]`);
    focusTarget?.focus();
  }, [state.focusField]);
  useEffect(() => {
    if (!state.selectedValues && !state.acknowledgments) return;
    const frame = window.requestAnimationFrame(() => {
      if (state.selectedValues) setSelected(state.selectedValues);
      if (state.acknowledgments) setAcknowledgments(state.acknowledgments);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state.acknowledgments, state.selectedValues]);
  const fieldErrors = state.fieldErrors ?? {};
  const errorFor = (field: RegistrationField) => fieldErrors[field];
  const updateValue = (field: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));
  const fieldProps = (field: RegistrationField) => ({
    "aria-invalid": Boolean(errorFor(field)),
    "aria-describedby": errorFor(field) ? `${field}-error` : undefined,
  });
  if (!participation || !dataUse)
    return (
      <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
        Registration is temporarily unavailable because the acknowledgment content is not
        configured.
      </p>
    );
  return (
    <form action={action} className="public-signup-form space-y-8" aria-busy={pending}>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="participationVersionId" value={participation.id} />
      <input type="hidden" name="dataUseVersionId" value={dataUse.id} />
      {publicSlug ? <input type="hidden" name="registrationSlug" value={publicSlug} /> : null}
      {seriesMode ? <input type="hidden" name="seriesMode" value="true" /> : null}
      <fieldset className="registration-date-selection">
        <legend className="w-full text-center text-xl font-semibold tracking-tight">
          Choose your dates
        </legend>
        <p className="mt-1 text-center text-sm text-slate-600">
          {seriesMode
            ? "Choose one or more dates in the next two weeks. Each date is reserved separately."
            : "Select one or more sessions. Your contact details are collected once."}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {grouped.map(([date, dateEvents]) => (
            <div
              key={date}
              className={`registration-date-card ${dateEvents.length > 1 ? "registration-date-card-multiple" : ""}`}
            >
              <h3 className="mb-3 text-center text-sm font-bold text-ink">{date}</h3>
              <div className="space-y-3">
                {dateEvents.map((event) => {
                  const full =
                    event.active_registration_count >= event.capacity ||
                    event.availability === "CLOSED" ||
                    event.availability === "CANCELLED";
                  const value = seriesMode
                    ? event.starts_at
                    : (publicSlug ?? event.id ?? event.name);
                  const isSelected = selected.includes(value);
                  const spotsAvailable = event.capacity - event.active_registration_count;
                  return (
                    <label
                      key={value}
                      className={`registration-slot relative ${full ? "registration-slot-full" : ""} ${isSelected ? "registration-slot-selected" : ""}`}
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
                        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                      />
                      <span
                        className={`registration-time-pill ${isSelected ? "registration-time-pill-selected" : ""}`}
                      >
                        {new Intl.DateTimeFormat("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: event.timezone,
                        }).format(new Date(event.starts_at))}
                      </span>
                      <span className="registration-slot-details">
                        <span className="block text-sm text-slate-600">
                          {full
                            ? "Full"
                            : `${spotsAvailable} ${spotsAvailable === 1 ? "spot" : "spots"} available`}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {errorFor("selectedOccurrenceStartsAt") ? (
          <p
            id="selectedOccurrenceStartsAt-error"
            className="mt-3 text-sm font-medium text-red-700"
            role="alert"
          >
            {errorFor("selectedOccurrenceStartsAt")}
          </p>
        ) : null}
        {selected.length ? (
          <div className="registration-selection-alert mt-5 rounded-2xl p-4" aria-live="polite">
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
        <h2 className="text-center text-xl font-semibold tracking-tight">Your details</h2>
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
            id="firstName"
            name="firstName"
            required
            maxLength={100}
            value={values.firstName}
            onChange={(event) => updateValue("firstName", event.target.value)}
            {...fieldProps("firstName")}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-brand"
          />
          {errorFor("firstName") ? (
            <p id="firstName-error" className="mt-1 text-sm text-red-700" role="alert">
              {errorFor("firstName")}
            </p>
          ) : null}
        </label>
        <label>
          Last name
          <input
            id="lastName"
            name="lastName"
            required
            maxLength={100}
            value={values.lastName}
            onChange={(event) => updateValue("lastName", event.target.value)}
            {...fieldProps("lastName")}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-brand"
          />
          {errorFor("lastName") ? (
            <p id="lastName-error" className="mt-1 text-sm text-red-700" role="alert">
              {errorFor("lastName")}
            </p>
          ) : null}
        </label>
        <label>
          Mobile phone
          <input
            id="phone"
            name="phone"
            required
            maxLength={40}
            value={values.phone}
            onChange={(event) => updateValue("phone", event.target.value)}
            {...fieldProps("phone")}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-brand"
          />
          {errorFor("phone") ? (
            <p id="phone-error" className="mt-1 text-sm text-red-700" role="alert">
              {errorFor("phone")}
            </p>
          ) : null}
        </label>
        <label>
          Phone country
          <select
            id="phoneCountry"
            name="phoneCountry"
            value={values.phoneCountry}
            onChange={(event) => updateValue("phoneCountry", event.target.value)}
            {...fieldProps("phoneCountry")}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-brand"
          >
            {["US", "CA", "GB", "AU", "IN"].map((country) => (
              <option key={country}>{country}</option>
            ))}
          </select>
          {errorFor("phoneCountry") ? (
            <p id="phoneCountry-error" className="mt-1 text-sm text-red-700" role="alert">
              {errorFor("phoneCountry")}
            </p>
          ) : null}
        </label>
        <label>
          Email (optional)
          <input
            id="email"
            name="email"
            type="email"
            maxLength={254}
            value={values.email}
            onChange={(event) => updateValue("email", event.target.value)}
            {...fieldProps("email")}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-brand"
          />
          {errorFor("email") ? (
            <p id="email-error" className="mt-1 text-sm text-red-700" role="alert">
              {errorFor("email")}
            </p>
          ) : null}
        </label>
        <label>
          Primary affiliation
          <select
            id="affiliation"
            name="affiliation"
            value={values.affiliation}
            onChange={(event) => updateValue("affiliation", event.target.value)}
            {...fieldProps("affiliation")}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-brand"
          >
            <option value="">Other / No affiliation</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          {errorFor("affiliation") ? (
            <p id="affiliation-error" className="mt-1 text-sm text-red-700" role="alert">
              {errorFor("affiliation")}
            </p>
          ) : null}
        </label>
      </fieldset>
      <fieldset disabled={Boolean(rememberedFirstName && !showDetails)} className="space-y-4">
        <label>
          Fitness experience (optional)
          <textarea
            id="fitnessExperience"
            name="fitnessExperience"
            maxLength={1000}
            value={values.fitnessExperience}
            onChange={(event) => updateValue("fitnessExperience", event.target.value)}
            {...fieldProps("fitnessExperience")}
            className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none transition focus:border-brand"
          />
          {errorFor("fitnessExperience") ? (
            <p id="fitnessExperience-error" className="mt-1 text-sm text-red-700" role="alert">
              {errorFor("fitnessExperience")}
            </p>
          ) : null}
        </label>
      </fieldset>
      <div className="space-y-4 rounded-2xl bg-sand/70 p-5">
        <label className="flex gap-3">
          <input
            id="participationAcknowledged"
            name="participationAcknowledged"
            type="checkbox"
            required
            checked={acknowledgments.participationAcknowledged}
            onChange={(event) =>
              setAcknowledgments((current) => ({
                ...current,
                participationAcknowledged: event.target.checked,
              }))
            }
            {...fieldProps("participationAcknowledged")}
            className="mt-1 h-5 w-5 accent-brand"
          />
          <span>{participation.text}</span>
        </label>
        {errorFor("participationAcknowledged") ? (
          <p id="participationAcknowledged-error" className="text-sm text-red-700" role="alert">
            {errorFor("participationAcknowledged")}
          </p>
        ) : null}
        <label className="flex gap-3">
          <input
            id="dataUseAcknowledged"
            name="dataUseAcknowledged"
            type="checkbox"
            required
            checked={acknowledgments.dataUseAcknowledged}
            onChange={(event) =>
              setAcknowledgments((current) => ({
                ...current,
                dataUseAcknowledged: event.target.checked,
              }))
            }
            {...fieldProps("dataUseAcknowledged")}
            className="mt-1 h-5 w-5 accent-brand"
          />
          <span>{dataUse.text}</span>
        </label>
        {errorFor("dataUseAcknowledged") ? (
          <p id="dataUseAcknowledged-error" className="text-sm text-red-700" role="alert">
            {errorFor("dataUseAcknowledged")}
          </p>
        ) : null}
      </div>
      {state.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">
          <p role="alert" aria-live="assertive">
            {state.error}
          </p>
          {Object.entries(fieldErrors).length ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
              {Object.entries(fieldErrors).map(([field, message]) => (
                <li key={field}>
                  <a className="underline" href={`#${field}`}>
                    {message}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <button
        disabled={pending}
        className="registration-time-pill public-book-class-control mx-auto block w-full disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {pending ? "Booking…" : useRemembered ? `Continue as ${rememberedFirstName}` : "Book Class"}
      </button>
      {useRemembered ? <input type="hidden" name="continueAsRemembered" value="true" /> : null}
    </form>
  );
}
