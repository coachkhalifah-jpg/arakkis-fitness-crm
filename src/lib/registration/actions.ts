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

async function executeRegistration(form: FormData, selectedEventIds: string[]) {
  let confirmationToken: string | undefined;
  const diagnosticCorrelationId = crypto.randomUUID();
  const rememberRequested = form.get("rememberDevice") === "on";
  console.info("[rc2-remembered-device] registration", {
    correlationId: diagnosticCorrelationId,
    remember_requested: rememberRequested,
  });
  const rememberedParticipant = await resolveRememberedParticipant();
  const remembered = form.get("continueAsRemembered") === "true" ? rememberedParticipant : null;
  const shouldRememberDevice =
    form.get("rememberDevice") === "on" &&
    form.get("continueAsRemembered") !== "true" &&
    !rememberedParticipant;
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
  if (error || !data) throw new Error("registration unavailable");
  const result = data as { confirmation_token?: string };
  if (!result.confirmation_token) throw new Error("submission already received");
  confirmationToken = result.confirmation_token;
  if (shouldRememberDevice)
    await rememberParticipantFromConfirmation(confirmationToken, diagnosticCorrelationId);
  return confirmationToken;
}

export async function submitRegistration(
  _state: RegistrationActionState,
  form: FormData,
): Promise<RegistrationActionState> {
  let confirmationToken: string | undefined;
  try {
    if (isProductionRegistrationBlocked())
      return { error: "Registration is temporarily unavailable while legal approval is pending." };
    confirmationToken = await executeRegistration(form, [
      ...new Set(form.getAll("eventIds").map(String)),
    ]);
  } catch (error) {
    if (error instanceof ZodError) return fieldErrorsFromZod(error, form);
    if (error instanceof Error && error.message.includes("valid phone"))
      return phoneValidationState(form);
    if (error instanceof Error && error.message === "invalid email")
      return emailValidationState(form);
    return { error: "The registration could not be completed. Please try again." };
  }
  redirect(`/registration/confirmation?token=${encodeURIComponent(confirmationToken!)}`);
}

export async function submitSlugRegistration(
  _state: RegistrationActionState,
  form: FormData,
): Promise<RegistrationActionState> {
  let confirmationToken: string;
  try {
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
      if (eventError || !recurringEvent?.series_slug)
        return { error: "This recurring event is unavailable." };
      const selected = (recurringEvent.occurrences ?? [])
        .filter((occurrence) => selectedStarts.includes(occurrence.starts_at))
        .map((occurrence) => occurrence.id);
      if (selected.length !== selectedStarts.length)
        return preserveSubmittedState(form, {
          error: "Please correct the highlighted registration fields.",
          fieldErrors: {
            selectedOccurrenceStartsAt: "Select only available dates within the next two weeks.",
          },
          focusField: "selectedOccurrenceStartsAt",
        });
      confirmationToken = await executeRegistration(form, selected);
    } else {
      const privileged = createPrivilegedClient();
      const { data: eventId, error: eventError } = await privileged.rpc("phase7_event_id_by_slug", {
        p_slug: slug,
      });
      if (eventError || !eventId) return { error: "This event is unavailable." };
      const { data: available, error } = await privileged.rpc("phase7_registration_available", {
        p_event_id: eventId,
      });
      if (error || !available)
        return { error: "Registration is no longer available for this event." };
      confirmationToken = await executeRegistration(form, [eventId]);
    }
  } catch (error) {
    if (error instanceof ZodError) return fieldErrorsFromZod(error, form);
    if (error instanceof Error && error.message.includes("valid phone"))
      return phoneValidationState(form);
    if (error instanceof Error && error.message === "invalid email")
      return emailValidationState(form);
    return { error: "This event is unavailable or registration could not be completed." };
  }
  redirect(`/registration/confirmation?token=${encodeURIComponent(confirmationToken)}`);
}

export { normalizeName };
