"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { ForgetDevice } from "@/components/registration/forget-device";
import { DisclosureToggle } from "@/components/ui/disclosure-toggle";
import {
  submitRegistration,
  submitSlugRegistration,
  type RegistrationField,
  type RegistrationActionState,
} from "@/lib/registration/actions";
import { participantDisplayName } from "@/lib/registration/display";
import { isUnavailableEvent } from "@/lib/registration/availability";
import { referralSourceOptions } from "@/lib/registration/referral";

const fitnessExperienceOptions = [
  "New to fitness",
  "Some fitness experience",
  "Regularly active",
  "Experienced / advanced",
  "Returning after a break",
  "Prefer not to say",
] as const;
const weekDayOptions = [
  { label: "S", name: "Sunday", index: 0 },
  { label: "M", name: "Monday", index: 1 },
  { label: "T", name: "Tuesday", index: 2 },
  { label: "W", name: "Wednesday", index: 3 },
  { label: "T", name: "Thursday", index: 4 },
  { label: "F", name: "Friday", index: 5 },
  { label: "S", name: "Saturday", index: 6 },
] as const;
import type { LegalDocument } from "@/lib/legal/documents";
import type { LegalPackage } from "@/lib/legal/package";

type Event = {
  id?: string;
  name: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  venue_name: string;
  venue_street?: string;
  venue_city?: string;
  venue_state?: string;
  venue_postal_code?: string;
  host_organization_name: string;
  active_registration_count: number;
  capacity: number;
  availability?: string;
  visibility: string;
};
type Acknowledgment = { id: string; text: string } | null;

function formatPhoneDisplay(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const digits = trimmed.replace(/\D/g, "");
  const assumedCountryCode = trimmed.startsWith("+")
    ? trimmed
    : `+${digits.length === 11 && digits.startsWith("1") ? digits : `1${digits}`}`;
  const parsed = parsePhoneNumberFromString(assumedCountryCode, "US");
  return parsed?.isValid() ? parsed.formatInternational() : value;
}

function RegistrationQuestion({
  question,
  subtext,
  as = "h2",
}: {
  question: string;
  subtext: string;
  as?: "h2" | "h3";
}) {
  const Heading = as;
  return (
    <div className="registration-question">
      <Heading className="registration-question-title">{question}</Heading>
      <p className="registration-question-subtext">{subtext}</p>
    </div>
  );
}

export function RegistrationForm({
  events,
  idempotencyKey,
  publicSlug,
  eventInviteToken = null,
  seriesMode = false,
  rememberedFirstName = null,
  rememberedGoals = null,
  legalDocuments = [],
  legalPackage,
}: {
  events: Event[];
  idempotencyKey: string;
  publicSlug?: string;
  eventInviteToken?: string | null;
  seriesMode?: boolean;
  rememberedFirstName?: string | null;
  rememberedGoals?: string | null;
  legalDocuments?: LegalDocument[];
  legalPackage: LegalPackage | null;
}) {
  const [state, action, pending] = useActionState<RegistrationActionState, FormData>(
    publicSlug ? submitSlugRegistration : submitRegistration,
    {},
  );
  const [activeRememberedFirstName, setActiveRememberedFirstName] = useState(rememberedFirstName);
  const [useRemembered, setUseRemembered] = useState(Boolean(rememberedFirstName));
  const [showDetails, setShowDetails] = useState(!rememberedFirstName);
  const selectionValue = (event: Event) =>
    seriesMode ? event.starts_at : (publicSlug ?? event.id ?? event.name);
  const eligibleEvents = events.filter((event) => !isUnavailableEvent(event));
  const [selected, setSelected] = useState<string[]>(() =>
    eligibleEvents.length > 0 && (eligibleEvents.length === 1 || seriesMode)
      ? [selectionValue(eligibleEvents[0])]
      : [],
  );
  const [weekdayFilter, setWeekdayFilter] = useState<number | null>(null);
  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    fitnessExperience: "",
    goals: rememberedGoals ?? "",
    referralSource: "",
    referralSourceOther: "",
  });
  const [rememberDevice, setRememberDevice] = useState(false);
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [waiverAcknowledged, setWaiverAcknowledged] = useState(false);
  const sortedEvents = useMemo(
    () =>
      [...events].sort(
        (left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
      ),
    [events],
  );
  const weekdayIndexFor = (event: Event) => {
    const weekday = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: event.timezone,
    }).format(new Date(event.starts_at));
    return weekDayOptions.findIndex((option) => option.name.startsWith(weekday));
  };
  const availableWeekdays = useMemo(
    () => new Set(eligibleEvents.map((event) => weekdayIndexFor(event))),
    [eligibleEvents],
  );
  const visibleEvents = useMemo(
    () =>
      weekdayFilter === null
        ? sortedEvents
        : sortedEvents.filter((event) => weekdayIndexFor(event) === weekdayFilter),
    [sortedEvents, weekdayFilter],
  );
  useEffect(() => {
    if (!state.focusField) return;
    const optionalFocusField = [
      "email",
      "fitnessExperience",
      "referralSource",
      "referralSourceOther",
      "goals",
    ].includes(state.focusField);
    if (optionalFocusField && !showOptionalDetails) {
      const frame = window.requestAnimationFrame(() => setShowOptionalDetails(true));
      return () => window.cancelAnimationFrame(frame);
    }
    const focusTarget =
      document.getElementById(state.focusField) ??
      document.querySelector<HTMLInputElement>(`[name="${state.focusField}"]`);
    focusTarget?.focus();
  }, [showOptionalDetails, state.focusField]);
  useEffect(() => {
    if (!state.selectedValues && state.legalPackageAcknowledged === undefined) return;
    const frame = window.requestAnimationFrame(() => {
      if (state.selectedValues) setSelected(state.selectedValues);
      if (state.rememberDevice !== undefined) setRememberDevice(state.rememberDevice);
      if (state.legalPackageAcknowledged !== undefined)
        setWaiverAcknowledged(state.legalPackageAcknowledged);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state.legalPackageAcknowledged, state.rememberDevice, state.selectedValues]);
  const fieldErrors = state.fieldErrors ?? {};
  const errorFor = (field: RegistrationField) => fieldErrors[field];
  const updateValue = (field: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));
  const fieldProps = (field: RegistrationField) => ({
    "aria-invalid": Boolean(errorFor(field)),
    "aria-describedby": errorFor(field) ? `${field}-error` : undefined,
  });
  const legalDocument = (type: string) => legalDocuments.find((document) => document.type === type);
  const packageComponent = (type: string) =>
    legalPackage?.components.find((component) => component.type === type);
  const packageDocuments =
    legalPackage?.components.map((component) => ({
      component,
      document: legalDocument(component.type),
    })) ?? [];
  const packageReady =
    Boolean(legalPackage) &&
    packageDocuments.length === 1 &&
    packageDocuments.every(({ document }) => Boolean(document));
  if (!legalPackage || !packageReady)
    return (
      <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
        Registration is temporarily unavailable because the acknowledgment content is not
        configured.
      </p>
    );
  return (
    <form action={action} className="public-signup-form space-y-8" aria-busy={pending}>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input
        type="hidden"
        name="participationVersionId"
        value={packageComponent("EOKE_PARTICIPATION_WAIVER")?.id ?? ""}
      />
      <input type="hidden" name="legalPackageId" value={legalPackage.id} />
      {legalPackage.components.map((component) => (
        <input key={component.id} type="hidden" name="legalDocumentIds" value={component.id} />
      ))}
      <input type="hidden" name="phoneCountry" value="US" />
      {waiverAcknowledged ? (
        <input type="hidden" name="legalPackageAcknowledged" value="on" />
      ) : null}
      {publicSlug ? <input type="hidden" name="registrationSlug" value={publicSlug} /> : null}
      {eventInviteToken ? (
        <input type="hidden" name="eventInviteToken" value={eventInviteToken} />
      ) : null}
      {seriesMode ? <input type="hidden" name="seriesMode" value="true" /> : null}
      <header className="registration-start-header" aria-labelledby="registration-start-title">
        <p>03 / MAKE IT OFFICIAL</p>
        <h2 id="registration-start-title">
          Save your
          <em>place.</em>
        </h2>
        <p>An intentional starting point for building confidence and consistency.</p>
      </header>
      <fieldset className="registration-date-selection">
        <legend className="sr-only">Choose an upcoming class</legend>
        <div className="registration-weekday-strip" aria-label="Filter classes by weekday">
          {weekDayOptions.map((option) => {
            const available = availableWeekdays.has(option.index);
            const active = weekdayFilter === option.index;
            return (
              <button
                key={option.index}
                type="button"
                className={`registration-weekday-option ${active ? "registration-weekday-option-active" : ""}`}
                aria-label={`${option.name}${available ? ", classes available" : ", no classes available"}`}
                aria-pressed={active}
                disabled={!available}
                onClick={() => setWeekdayFilter(active ? null : option.index)}
              >
                <span>{option.label}</span>
                <span
                  className={`registration-weekday-dot ${available ? "registration-weekday-dot-visible" : ""}`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
        <div className="registration-occurrence-list">
          {visibleEvents.map((event) => {
            const full = isUnavailableEvent(event);
            const value = selectionValue(event);
            const isSelected = selected.includes(value);
            const displayName = participantDisplayName(event.name);
            const longDate = new Intl.DateTimeFormat("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: event.timezone,
            }).format(new Date(event.starts_at));
            const date = new Date(event.starts_at);
            const weekday = new Intl.DateTimeFormat("en-US", {
              weekday: "short",
              timeZone: event.timezone,
            }).format(date);
            const day = new Intl.DateTimeFormat("en-US", {
              day: "numeric",
              timeZone: event.timezone,
            }).format(date);
            const month = new Intl.DateTimeFormat("en-US", {
              month: "short",
              timeZone: event.timezone,
            }).format(date);
            const time = new Intl.DateTimeFormat("en-US", {
              hour: "numeric",
              minute: "2-digit",
              timeZone: event.timezone,
            }).format(new Date(event.starts_at));
            const availabilityLabel = full
              ? event.active_registration_count >= event.capacity || event.availability === "FULL"
                ? "Full"
                : "Unavailable"
              : "Open";
            return (
              <label
                key={value}
                className={`registration-occurrence-option ${full ? "registration-occurrence-option-full" : ""} ${isSelected ? "registration-occurrence-option-selected" : ""}`}
              >
                <input
                  type="checkbox"
                  aria-label={`${displayName}, ${longDate}, ${time}, ${availabilityLabel}, ${isSelected ? "selected" : "not selected"}`}
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
                  className="registration-occurrence-input"
                />
                <span className="registration-occurrence-date">
                  <span>{weekday}</span>
                  <strong>{day}</strong>
                  <span>{month}</span>
                </span>
                <span className="registration-occurrence-time-group">
                  {full ? (
                    <span className="registration-occurrence-selected-label registration-occurrence-full-label">
                      Full
                    </span>
                  ) : isSelected ? (
                    <span className="registration-occurrence-selected-label">Selected</span>
                  ) : null}
                  <span
                    className={`registration-occurrence-time registration-time-pill ${isSelected ? "registration-time-pill-selected" : ""}`}
                  >
                    {time}
                  </span>
                </span>
                <span className="registration-occurrence-meta">
                  {full ? (
                    <span className="registration-occurrence-full-mark" aria-hidden="true">
                      ×
                    </span>
                  ) : isSelected ? (
                    <span className="registration-occurrence-check" aria-hidden="true">
                      ✓
                    </span>
                  ) : (
                    <span className="registration-occurrence-arrow" aria-hidden="true">
                      ↗
                    </span>
                  )}
                </span>
              </label>
            );
          })}
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
      {activeRememberedFirstName ? (
        <div className="rounded-2xl border border-brand/20 bg-brand/[0.06] p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">
            Welcome back
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">
            Continue as {activeRememberedFirstName}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Booking with the details saved on this device. Your acknowledgments still apply to this
            booking.
          </p>
          <DisclosureToggle
            className="returning-participant-details-toggle mt-4 flex min-h-12 w-full items-center justify-between rounded-xl border border-brand/20 bg-white px-4 text-left text-sm font-semibold"
            expanded={showDetails}
            controls="returning-participant-details"
            onClick={() => {
              setUseRemembered(showDetails);
              setShowDetails(!showDetails);
            }}
          >
            <span>
              {showDetails ? "Use saved details" : "Edit details or use a different person"}
            </span>
          </DisclosureToggle>
          <ForgetDevice
            onForgot={() => {
              setActiveRememberedFirstName(null);
              setUseRemembered(false);
              setShowDetails(true);
            }}
          />
        </div>
      ) : null}
      <header className="registration-details-hero" aria-labelledby="registration-details-title">
        <p>Your details</p>
        <h2 id="registration-details-title">
          Make it
          <em>yours.</em>
        </h2>
      </header>
      <div
        id="returning-participant-details"
        hidden={Boolean(activeRememberedFirstName && !showDetails)}
        className="space-y-4"
      >
        <fieldset
          disabled={Boolean(activeRememberedFirstName && !showDetails)}
          className="grid gap-4"
        >
          <label className="registration-field-label">
            <span className="registration-field-title">First name</span>
            <input
              id="firstName"
              name="firstName"
              required
              maxLength={100}
              placeholder="Your first name"
              value={values.firstName}
              onChange={(event) => updateValue("firstName", event.target.value)}
              {...fieldProps("firstName")}
              className="registration-field-control mt-2 w-full px-3 outline-none transition"
            />
            {errorFor("firstName") ? (
              <p id="firstName-error" className="mt-1 text-sm text-red-700" role="alert">
                {errorFor("firstName")}
              </p>
            ) : null}
          </label>
          <label className="registration-field-label">
            <span className="registration-field-title">Last name</span>
            <input
              id="lastName"
              name="lastName"
              required
              maxLength={100}
              placeholder="Your last name"
              value={values.lastName}
              onChange={(event) => updateValue("lastName", event.target.value)}
              {...fieldProps("lastName")}
              className="registration-field-control mt-2 w-full px-3 outline-none transition"
            />
            {errorFor("lastName") ? (
              <p id="lastName-error" className="mt-1 text-sm text-red-700" role="alert">
                {errorFor("lastName")}
              </p>
            ) : null}
          </label>
        </fieldset>
        <fieldset
          disabled={Boolean(activeRememberedFirstName && !showDetails)}
          className="grid gap-4"
        >
          <label className="registration-field-label">
            <span className="registration-field-title">Mobile phone</span>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              maxLength={40}
              placeholder="+1 111-111-1111"
              value={values.phone}
              onChange={(event) => updateValue("phone", event.target.value)}
              onBlur={(event) => updateValue("phone", formatPhoneDisplay(event.target.value))}
              {...fieldProps("phone")}
              className="registration-field-control mt-2 w-full px-3 outline-none transition"
            />
            {errorFor("phone") ? (
              <p id="phone-error" className="mt-1 text-sm text-red-700" role="alert">
                {errorFor("phone")}
              </p>
            ) : null}
          </label>
        </fieldset>
        <div className="registration-optional-section">
          <DisclosureToggle
            className="registration-optional-toggle"
            expanded={showOptionalDetails}
            controls="registration-optional-details"
            onClick={() => setShowOptionalDetails((current) => !current)}
          >
            <span>
              <span className="registration-optional-toggle-title">Help us help you</span>
              <span className="registration-optional-toggle-meta">Optional</span>
            </span>
          </DisclosureToggle>
          <div
            id="registration-optional-details"
            hidden={!showOptionalDetails}
            className="registration-optional-details"
          >
            <fieldset
              disabled={Boolean(activeRememberedFirstName && !showDetails)}
              className="grid gap-4"
            >
              <label className="registration-field-label">
                <span className="registration-field-title">Email</span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  maxLength={254}
                  placeholder="you@example.com"
                  value={values.email}
                  onChange={(event) => updateValue("email", event.target.value)}
                  {...fieldProps("email")}
                  className="registration-field-control mt-2 w-full px-3 outline-none transition"
                />
                {errorFor("email") ? (
                  <p id="email-error" className="mt-1 text-sm text-red-700" role="alert">
                    {errorFor("email")}
                  </p>
                ) : null}
              </label>
              <RegistrationQuestion
                question="Tell us a little about you."
                subtext="This helps your coach understand your experience."
                as="h3"
              />
              <label className="registration-field-label">
                <span className="registration-field-title">Fitness experience</span>
                <select
                  id="fitnessExperience"
                  name="fitnessExperience"
                  value={values.fitnessExperience}
                  onChange={(event) => updateValue("fitnessExperience", event.target.value)}
                  {...fieldProps("fitnessExperience")}
                  className="registration-field-control registration-select-control mt-2 w-full px-3 outline-none"
                >
                  <option value="">Select one</option>
                  {!fitnessExperienceOptions.includes(
                    values.fitnessExperience as (typeof fitnessExperienceOptions)[number],
                  ) && values.fitnessExperience ? (
                    <option value={values.fitnessExperience}>{values.fitnessExperience}</option>
                  ) : null}
                  {fitnessExperienceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {errorFor("fitnessExperience") ? (
                  <p
                    id="fitnessExperience-error"
                    className="mt-1 text-sm text-red-700"
                    role="alert"
                  >
                    {errorFor("fitnessExperience")}
                  </p>
                ) : null}
              </label>
              <label className="registration-field-label">
                <span className="registration-field-title">How did you hear about us?</span>
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
                  className="registration-field-control registration-select-control mt-2 w-full px-3 outline-none"
                >
                  <option value="">Select one</option>
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
                <label className="registration-field-label">
                  <span className="registration-field-title">Help us help you</span>
                  <input
                    id="referralSourceOther"
                    name="referralSourceOther"
                    maxLength={200}
                    value={values.referralSourceOther}
                    onChange={(event) => updateValue("referralSourceOther", event.target.value)}
                    {...fieldProps("referralSourceOther")}
                    className="registration-field-control mt-2 w-full px-3 outline-none transition"
                  />
                  {errorFor("referralSourceOther") ? (
                    <p
                      id="referralSourceOther-error"
                      className="mt-1 text-sm text-red-700"
                      role="alert"
                    >
                      {errorFor("referralSourceOther")}
                    </p>
                  ) : null}
                </label>
              ) : null}
              <RegistrationQuestion
                question="What are you working toward?"
                subtext="Share anything that would help your coach support you."
                as="h3"
              />
              <label className="registration-field-label">
                <span className="registration-field-title">Goals</span>
                <textarea
                  id="goals"
                  name="goals"
                  maxLength={500}
                  placeholder="What would you like to get from class?"
                  value={values.goals}
                  onChange={(event) => updateValue("goals", event.target.value)}
                  {...fieldProps("goals")}
                  className="registration-field-control mt-2 w-full px-3 py-3 outline-none transition"
                />
                {errorFor("goals") ? (
                  <p id="goals-error" className="mt-1 text-sm text-red-700" role="alert">
                    {errorFor("goals")}
                  </p>
                ) : null}
              </label>
            </fieldset>
          </div>
        </div>
      </div>
      <div className="registration-legal-section space-y-5">
        <RegistrationQuestion
          question="One last thing."
          subtext="Review and accept the required waiver before reserving your spot."
        />
        <label className="flex gap-3">
          <input
            id="legalPackageAcknowledged"
            name="legalPackageAcknowledged"
            type="checkbox"
            required
            checked={waiverAcknowledged}
            onChange={(event) => setWaiverAcknowledged(event.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 accent-brand"
          />
          <span>
            I have read and agree to the{" "}
            <a
              className="font-semibold underline"
              href="/legal/liability-waiver"
              target="_blank"
              rel="noreferrer"
            >
              Eoke LLC Participation Liability Waiver
            </a>{" "}
            (Version {legalPackage.version}).
          </span>
        </label>
      </div>
      {!activeRememberedFirstName ? (
        <fieldset className="registration-device-section">
          <legend className="sr-only">Optional device recognition</legend>
          <label className="flex min-h-12 items-start gap-3">
            <input
              id="rememberDevice"
              name="rememberDevice"
              type="checkbox"
              aria-describedby="rememberDevice-description"
              checked={rememberDevice}
              onChange={(event) => setRememberDevice(event.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-brand"
            />
            <span>
              <span className="block font-semibold text-ink">
                Make future bookings faster on this device
              </span>
              <span
                id="rememberDevice-description"
                className="mt-1 block text-sm leading-6 text-slate-600"
              >
                We’ll securely remember this device so you won’t need to enter your information
                again. You can remove this at any time.
              </span>
            </span>
          </label>
        </fieldset>
      ) : null}
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
        className="registration-reserve-button mx-auto disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? "Booking…"
          : useRemembered && activeRememberedFirstName
            ? `Continue as ${activeRememberedFirstName}`
            : "Book Class"}
      </button>
      {useRemembered ? <input type="hidden" name="continueAsRemembered" value="true" /> : null}
    </form>
  );
}
