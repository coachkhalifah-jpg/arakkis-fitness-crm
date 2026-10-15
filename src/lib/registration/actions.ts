"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { createPrivilegedClient } from "@/lib/db/privileged";
import { isProductionRegistrationBlocked } from "@/lib/config/env";
import { assertPublicSlug } from "@/lib/services/phase-7";
import {
  rememberParticipantFromConfirmation,
  resolveRememberedParticipant,
} from "@/lib/registration/device";
import { ZodError } from "zod";
import {
  normalizeEmail,
  normalizeName,
  normalizePhone,
  participantInputSchema,
} from "@/lib/registration/normalization";
import { logHostedAccessDiagnostic } from "@/lib/diagnostics/hosted-access";
import {
  actionErrorFromRegistrationFailure,
  isAlreadyRegisteredOutcome,
  noReservedClassError,
  successfulRegistrationResults,
  type RegistrationResultItem,
} from "@/lib/registration/result-outcomes";
import { rethrowNextControlFlow } from "@/lib/navigation/rethrow-next";

export type RegistrationField =
  | "selectedOccurrenceStartsAt"
  | "eventIds"
  | "firstName"
  | "lastName"
  | "phone"
  | "phoneCountry"
  | "email"
  | "fitnessExperience"
  | "goals"
  | "referralSource"
  | "referralSourceOther"
  | "legalPackageAcknowledged";

export type RegistrationActionState = {
  error?: string;
  fieldErrors?: Partial<Record<RegistrationField, string>>;
  focusField?: RegistrationField;
  selectedValues?: string[];
  legalPackageAcknowledged?: boolean;
  rememberDevice?: boolean;
  /** When true, show Manage bookings CTA (device already remembered). */
  showManageBookings?: boolean;
};
export type RegistrationAction = (
  state: RegistrationActionState,
  form: FormData,
) => Promise<RegistrationActionState>;

function preserveSubmittedState(
  form: FormData,
  state: RegistrationActionState,
): RegistrationActionState {
  const occurrenceValues = form.getAll("selectedOccurrenceStartsAt").map(String);
  const eventValues = form.getAll("eventIds").map(String);
  const selectedEventValues = form.getAll("selectedEvent").map(String);
  const publicValues = form.getAll("publicSlug").map(String);
  const selectedValues = occurrenceValues.length
    ? [...new Set(occurrenceValues)]
    : eventValues.length
      ? [...new Set(eventValues)]
      : selectedEventValues.length
        ? [...new Set(selectedEventValues)]
        : publicValues.length
          ? [publicValues[0]]
          : [];
  return {
    ...state,
    selectedValues,
    legalPackageAcknowledged: form.get("legalPackageAcknowledged") === "on",
    rememberDevice: form.get("rememberDevice") === "on",
  };
}

async function registrationFailureState(
  form: FormData,
  outcomeError: string,
): Promise<RegistrationActionState> {
  const alreadyRegistered = isAlreadyRegisteredOutcome(outcomeError);
  const remembered = alreadyRegistered ? await resolveRememberedParticipant() : null;
  return preserveSubmittedState(form, {
    error: outcomeError,
    showManageBookings: Boolean(alreadyRegistered && remembered),
  });
}

function fieldErrorsFromZod(error: ZodError, form: FormData): RegistrationActionState {
  const fieldErrors: Partial<Record<RegistrationField, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    const field = key === "eventIds" ? "selectedOccurrenceStartsAt" : key;
    if (typeof field === "string" && !(field in fieldErrors)) {
      fieldErrors[field as RegistrationField] = issue.message;
    }
  }
  const focusField = Object.keys(fieldErrors)[0] as RegistrationField | undefined;
  return preserveSubmittedState(form, {
    error: "Please correct the highlighted registration fields.",
    fieldErrors,
    focusField,
  });
}

function phoneValidationState(form: FormData): RegistrationActionState {
  return preserveSubmittedState(form, {
    error: "Please correct the highlighted registration fields.",
    fieldErrors: { phone: "Enter a valid phone number for the selected country." },
    focusField: "phone",
  });
}

function emailValidationState(form: FormData): RegistrationActionState {
  return preserveSubmittedState(form, {
    error: "Please correct the highlighted registration fields.",
    fieldErrors: { email: "Enter a valid email address." },
    focusField: "email",
  });
}

async function executeRegistration(
  form: FormData,
  selectedEventIds: string[],
  diagnosticCorrelationId = crypto.randomUUID(),
) {
  logHostedAccessDiagnostic({
    correlation_id: diagnosticCorrelationId,
    boundary: "registration_submission",
    remember_requested: form.get("rememberDevice") === "on",
  });
  let confirmationToken: string | undefined;
  const rememberedParticipant = await resolveRememberedParticipant(
    undefined,
    diagnosticCorrelationId,
  );
  const continuingAsRemembered = form.get("continueAsRemembered") === "true";
  const remembered = continuingAsRemembered ? rememberedParticipant : null;
  // Issue a device token whenever the participant asked to remember on this
  // submit. Do not skip just because a prior cookie exists (UAT-009): that
  // previously left confirmation showing Remember after a checked registration.
  const shouldRememberDevice = form.get("rememberDevice") === "on" && !continuingAsRemembered;
  const input = participantInputSchema.parse({
    firstName: remembered?.first_name ?? form.get("firstName"),
    lastName: remembered?.last_name ?? form.get("lastName"),
    phone: remembered?.display_phone ?? form.get("phone"),
    phoneCountry: remembered?.phone_country ?? form.get("phoneCountry"),
    email: remembered?.email ?? form.get("email") ?? "",
    fitnessExperience: remembered?.fitness_experience ?? form.get("fitnessExperience") ?? "",
    goals: remembered?.goals ?? form.get("goals") ?? "",
    referralSource: form.get("referralSource") ?? "",
    referralSourceOther: form.get("referralSourceOther") ?? "",
    eventIds: selectedEventIds,
    legalPackageAcknowledged: form.get("legalPackageAcknowledged"),
  });
  const normalizedPhone = normalizePhone(input.phone, input.phoneCountry);
  let normalizedEmail: string | null;
  try {
    normalizedEmail = normalizeEmail(input.email ?? "");
  } catch (error) {
    if (error instanceof ZodError) throw new Error("invalid email");
    throw error;
  }
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 500);
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipAddress =
    forwarded ??
    requestHeaders.get("x-real-ip") ??
    (process.env.NODE_ENV === "development" ? "127.0.0.1" : null);
  if (!userAgent || !ipAddress) throw new Error("registration evidence unavailable");
  const db = await createClient();
  const legalDocumentIds = [...new Set(form.getAll("legalDocumentIds").map(String))];
  const { data, error } = await db.rpc("register_selected_events_with_access", {
    p_payload: {
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      display_phone: input.phone.trim(),
      normalized_phone: normalizedPhone.e164,
      phone_country: normalizedPhone.country,
      email: normalizedEmail,
      normalized_email: normalizedEmail,
      fitness_experience: input.fitnessExperience || null,
      // Optional Goals (DEC-061 / UAT-016). Null when empty so existing CRM goals
      // stay untouched (RPC updates only when p_goals is set).
      goals: input.goals || null,
      event_ids: input.eventIds,
      event_access_token: String(form.get("eventInviteToken") || ""),
      participation_acknowledgment_version_id: String(form.get("participationVersionId")),
      data_use_acknowledgment_version_id: null,
      participation_acknowledged_at: new Date().toISOString(),
      data_use_acknowledged_at: new Date().toISOString(),
      ip_address: ipAddress,
      user_agent: userAgent,
      idempotency_key: String(form.get("idempotencyKey") || crypto.randomUUID()),
      referral_source: input.referralSource || null,
      referral_source_other_text:
        input.referralSource === "OTHER" ? input.referralSourceOther || null : null,
      legal_document_version_ids: legalDocumentIds,
      legal_package_id: String(form.get("legalPackageId")),
    },
  } as never);
  if (error || !data) {
    logHostedAccessDiagnostic({
      correlation_id: diagnosticCorrelationId,
      boundary: "registration_submission",
      outcome_category: error ? "rpc_failure" : "data_state_failure",
    });
    throw new Error("registration unavailable");
  }
  const result = data as {
    confirmation_token?: string;
    results?: RegistrationResultItem[];
  };
  if (!result.confirmation_token) {
    logHostedAccessDiagnostic({
      correlation_id: diagnosticCorrelationId,
      boundary: "registration_submission",
      outcome_category: "data_state_failure",
    });
    throw new Error("submission already received");
  }
  // Confirmation bearer access requires at least one successful reservation
  // (migration 0016). Keep the participant on the form with a calm recovery
  // message instead of redirecting to an unavailable confirmation page.
  if (!successfulRegistrationResults(result.results).length) {
    logHostedAccessDiagnostic({
      correlation_id: diagnosticCorrelationId,
      boundary: "registration_submission",
      outcome_category: "data_state_failure",
    });
    throw noReservedClassError(result.results);
  }
  confirmationToken = result.confirmation_token;
  // Returning/continue-as-remembered already has a device cookie — still signal
  // confirmation to hide the duplicate Remember chrome (UAT-009).
  let deviceRemembered = continuingAsRemembered && Boolean(rememberedParticipant);
  if (shouldRememberDevice) {
    const issued = await rememberParticipantFromConfirmation(
      confirmationToken,
      diagnosticCorrelationId,
    );
    // Do not block confirmation on remember failure; the confirmation page still
    // offers Save on this device. Log outcome for hosted diagnosis.
    if (issued && "error" in issued && issued.error) {
      logHostedAccessDiagnostic({
        correlation_id: diagnosticCorrelationId,
        boundary: "registration_submission",
        outcome_category: "rpc_failure",
        device_rpc_status: "error",
        cookie_set_attempted: true,
        cookie_set_completed: false,
      });
      // Prior cookie still means this browser is remembered — hide confirmation prompt.
      if (rememberedParticipant) deviceRemembered = true;
    } else if (issued && "firstName" in issued) {
      deviceRemembered = true;
    }
  } else if (!deviceRemembered)
    logHostedAccessDiagnostic({
      correlation_id: diagnosticCorrelationId,
      boundary: "registration_submission",
      outcome_category: "success",
      device_rpc_attempted: false,
      cookie_set_attempted: false,
    });
  return { confirmationToken, diagnosticCorrelationId, deviceRemembered };
}

/** Confirmation URL after booking; `remembered=1` hides the duplicate Remember UI (UAT-009). */
function confirmationRedirectHref(
  confirmationToken: string,
  diagnosticCorrelationId: string,
  deviceRemembered: boolean,
) {
  const params = new URLSearchParams({
    token: confirmationToken,
    correlationId: diagnosticCorrelationId,
  });
  if (deviceRemembered) params.set("remembered", "1");
  return `/registration/confirmation?${params.toString()}`;
}

export async function submitRegistration(
  _state: RegistrationActionState,
  form: FormData,
): Promise<RegistrationActionState> {
  let confirmationToken: string | undefined;
  let diagnosticCorrelationId: string | undefined;
  let deviceRemembered = false;
  try {
    if (isProductionRegistrationBlocked())
      return { error: "Registration is temporarily unavailable while legal approval is pending." };
    const result = await executeRegistration(form, [
      ...new Set(form.getAll("eventIds").map(String)),
    ]);
    confirmationToken = result.confirmationToken;
    diagnosticCorrelationId = result.diagnosticCorrelationId;
    deviceRemembered = result.deviceRemembered;
  } catch (error) {
    if (error instanceof ZodError) return fieldErrorsFromZod(error, form);
    if (error instanceof Error && error.message.includes("valid phone"))
      return phoneValidationState(form);
    if (error instanceof Error && error.message === "invalid email")
      return emailValidationState(form);
    const outcomeError = actionErrorFromRegistrationFailure(error);
    if (outcomeError) return registrationFailureState(form, outcomeError);
    return { error: "The registration could not be completed. Please try again." };
  }
  redirect(
    confirmationRedirectHref(confirmationToken!, diagnosticCorrelationId!, deviceRemembered),
  );
}

export async function submitSlugRegistration(
  _state: RegistrationActionState,
  form: FormData,
): Promise<RegistrationActionState> {
  let confirmationToken: string;
  let diagnosticCorrelationId: string;
  let deviceRemembered = false;
  try {
    diagnosticCorrelationId = crypto.randomUUID();
    if (isProductionRegistrationBlocked())
      return { error: "Registration is temporarily unavailable while legal approval is pending." };
    const slug = assertPublicSlug(
      String(form.get("registrationSlug") ?? form.get("publicSlug") ?? ""),
    );
    const seriesMode = form.get("seriesMode") === "true";
    const selectedStarts = [...new Set(form.getAll("selectedOccurrenceStartsAt").map(String))];
    if (seriesMode && !selectedStarts.length) {
      return preserveSubmittedState(form, {
        error: "Please correct the highlighted registration fields.",
        fieldErrors: { selectedOccurrenceStartsAt: "Select at least one class date." },
        focusField: "selectedOccurrenceStartsAt",
      });
    }
    if (selectedStarts.length) {
      const db = await createClient();
      const { data: event, error: eventError } = await db.rpc("get_public_event_by_slug_access", {
        p_slug: slug,
        p_invite_token: String(form.get("eventInviteToken") || "") || null,
      });
      const recurringEvent = event as {
        series_slug?: string | null;
        occurrences?: Array<{ id: string; starts_at: string }>;
      } | null;
      if (eventError || !recurringEvent?.series_slug) {
        logHostedAccessDiagnostic({
          correlation_id: diagnosticCorrelationId,
          boundary: "registration_submission",
          outcome_category: eventError ? "rpc_failure" : "data_state_failure",
        });
        return { error: "This recurring event is unavailable." };
      }
      const selected = (recurringEvent.occurrences ?? [])
        .filter((occurrence) => selectedStarts.includes(occurrence.starts_at))
        .map((occurrence) => occurrence.id);
      if (selected.length !== selectedStarts.length) {
        logHostedAccessDiagnostic({
          correlation_id: diagnosticCorrelationId,
          boundary: "registration_submission",
          outcome_category: "data_state_failure",
        });
        return preserveSubmittedState(form, {
          error: "Please correct the highlighted registration fields.",
          fieldErrors: {
            selectedOccurrenceStartsAt: "Select only available dates within the next two weeks.",
          },
          focusField: "selectedOccurrenceStartsAt",
        });
      }
      const result = await executeRegistration(form, selected, diagnosticCorrelationId);
      confirmationToken = result.confirmationToken;
      deviceRemembered = result.deviceRemembered;
    } else {
      const privileged = createPrivilegedClient();
      const { data: eventId, error: eventError } = await privileged.rpc("phase7_event_id_by_slug", {
        p_slug: slug,
      });
      if (eventError || !eventId) {
        logHostedAccessDiagnostic({
          correlation_id: diagnosticCorrelationId,
          boundary: "registration_submission",
          outcome_category: eventError ? "rpc_failure" : "data_state_failure",
        });
        return { error: "This event is unavailable." };
      }
      const { data: available, error } = await privileged.rpc("phase7_registration_available", {
        p_event_id: eventId,
      });
      if (error || !available) {
        logHostedAccessDiagnostic({
          correlation_id: diagnosticCorrelationId,
          boundary: "registration_submission",
          outcome_category: error ? "rpc_failure" : "data_state_failure",
        });
        return { error: "Registration is no longer available for this event." };
      }
      const result = await executeRegistration(form, [eventId], diagnosticCorrelationId);
      confirmationToken = result.confirmationToken;
      deviceRemembered = result.deviceRemembered;
    }
  } catch (error) {
    if (error instanceof ZodError) return fieldErrorsFromZod(error, form);
    if (error instanceof Error && error.message.includes("valid phone"))
      return phoneValidationState(form);
    if (error instanceof Error && error.message === "invalid email")
      return emailValidationState(form);
    const outcomeError = actionErrorFromRegistrationFailure(error);
    if (outcomeError) return registrationFailureState(form, outcomeError);
    return { error: "This event is unavailable or registration could not be completed." };
  }
  redirect(confirmationRedirectHref(confirmationToken, diagnosticCorrelationId!, deviceRemembered));
}

export type RememberDeviceConfirmationState = {
  error?: string;
};

export async function rememberDeviceOnConfirmation(
  confirmationToken: string,
  correlationId: string,
  _state: RememberDeviceConfirmationState,
  form: FormData,
): Promise<RememberDeviceConfirmationState> {
  if (form.get("rememberDevice") !== "on") {
    return {
      error: "Check Remember this device to keep your classes available on this browser.",
    };
  }
  // Prefer the bound confirmation token from the page; fall back to the form field.
  const token = String(confirmationToken || form.get("token") || "").trim();
  const resolvedCorrelationId = String(
    correlationId || form.get("correlationId") || crypto.randomUUID(),
  ).trim();
  if (!token) return { error: "This confirmation link is no longer available." };
  const result = await rememberParticipantFromConfirmation(token, resolvedCorrelationId);
  if (result?.error) return { error: result.error };
  redirect(confirmationRedirectHref(token, resolvedCorrelationId, true));
}

export { normalizeName };
