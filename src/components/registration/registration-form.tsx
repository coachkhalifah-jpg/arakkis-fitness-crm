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
import { participantDisplayName } from "@/lib/registration/display";
import { referralSourceOptions } from "@/lib/registration/referral";

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
type Acknowledgment = { id: string; text: string } | null;

function isUnavailableEvent(event: Event) {
  return (
    event.active_registration_count >= event.capacity ||
    ["FULL", "CLOSED", "CANCELLED", "PAUSED", "NOT_YET_OPEN"].includes(event.availability ?? "")
  );
}

export function RegistrationForm({
  events,
  participation,
  dataUse,
  idempotencyKey,
  publicSlug,
  seriesMode = false,
  rememberedFirstName = null,
}: {
  events: Event[];
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
  const selectionValue = (event: Event) =>
    seriesMode ? event.starts_at : (publicSlug ?? event.id ?? event.name);
  const eligibleEvents = events.filter((event) => !isUnavailableEvent(event));
  const [selected, setSelected] = useState<string[]>(() =>
    eligibleEvents.length === 1 ? [selectionValue(eligibleEvents[0])] : [],
  );
  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    fitnessExperience: "",
    referralSource: "",
    referralSourceOther: "",
  });
  const [acknowledgments, setAcknowledgments] = useState({
    participationAcknowledged: false,
    dataUseAcknowledged: false,
  });
  const grouped = useMemo(() => {
    const groups = new Map<string, Event[]>();
    const sortedEvents = [...events].sort(
      (left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
    );
    for (const event of sortedEvents) {
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
      <input type="hidden" name="phoneCountry" value="US" />
      {publicSlug ? <input type="hidden" name="registrationSlug" value={publicSlug} /> : null}
      {seriesMode ? <input type="hidden" name="seriesMode" value="true" /> : null}
      <fieldset className="registration-date-selection">
        <legend className="w-full text-center text-xl font-semibold tracking-tight">
          Save your spot
        </legend>
        <p className="mt-1 text-center text-sm text-slate-600">
          {events.length === 1
            ? "You’re reserving the class below."
            : seriesMode || !publicSlug
              ? "Choose one or more class times that work for you."
              : "Choose the class time that works for you."}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {grouped.map(([date, dateEvents]) => (
            <div
              key={date}
              className={`registration-date-card w-full ${dateEvents.length > 1 ? "registration-date-card-multiple" : ""}`}
            >
              <h3 className="mb-3 text-center text-sm font-bold text-ink">{date}</h3>
              <div className="space-y-3">
                {dateEvents.map((event) => {
                  const full = isUnavailableEvent(event);
                  const value = selectionValue(event);
                  const isSelected = selected.includes(value);
                  const displayName = participantDisplayName(event.name);
                  const time = new Intl.DateTimeFormat("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: event.timezone,
                  }).format(new Date(event.starts_at));
                  const availabilityLabel = full
                    ? event.active_registration_count >= event.capacity ||
                      event.availability === "FULL"
                      ? "Full"
                      : "Unavailable"
                    : "open";
                  return (
                    <label
                      key={value}
                      className={`registration-slot relative ${full ? "registration-slot-full" : ""}`}
                    >
                      <input
                        type="checkbox"
                        aria-label={`${displayName}, ${date}, ${time}, ${availabilityLabel}, ${isSelected ? "selected" : "not selected"}`}
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
                        {time}
                      </span>
                      <span className="registration-slot-details">
                        <span className="block text-sm text-slate-600">{availabilityLabel}</span>
                        {isSelected ? (
                          <span className="registration-slot-state mt-1 block text-xs font-semibold uppercase tracking-[0.12em] text-brand">
                            SELECTED
                          </span>
                        ) : null}
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
      <fieldset disabled={Boolean(rememberedFirstName && !showDetails)} className="grid gap-4">
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
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            maxLength={40}
            placeholder="+1 518-867-5309"
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
          How did you hear about us? — Optional
          <select
            id="referralSource"
            name="referralSource"
            value={values.referralSource}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                referralSource: event.target.value,
                referralSourceOther:
                  event.target.value === "OTHER" ? current.referralSourceOther : "",
              }))
            }
            {...fieldProps("referralSource")}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-brand"
          >
            <option value="">Select an option</option>
            {referralSourceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errorFor("referralSource") ? (
            <p id="referralSource-error" className="mt-1 text-sm text-red-700" role="alert">
              {errorFor("referralSource")}
            </p>
          ) : null}
        </label>
        {values.referralSource === "OTHER" ? (
          <label>
            Tell us a little more (optional)
            <input
              id="referralSourceOther"
              name="referralSourceOther"
              maxLength={200}
              value={values.referralSourceOther}
              onChange={(event) => updateValue("referralSourceOther", event.target.value)}
              {...fieldProps("referralSourceOther")}
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-brand"
            />
            {errorFor("referralSourceOther") ? (
              <p id="referralSourceOther-error" className="mt-1 text-sm text-red-700" role="alert">
                {errorFor("referralSourceOther")}
              </p>
            ) : null}
          </label>
        ) : null}
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
