"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { createPrivilegedClient } from "@/lib/db/privileged";
import { isProductionRegistrationBlocked } from "@/lib/config/env";
import { assertPublicSlug } from "@/lib/services/phase-7";
import {
  normalizeEmail,
  normalizeName,
  normalizePhone,
  participantInputSchema,
} from "@/lib/registration/normalization";

export type RegistrationActionState = { error?: string };
export type RegistrationAction = (
  state: RegistrationActionState,
  form: FormData,
) => Promise<RegistrationActionState>;

async function executeRegistration(form: FormData, selectedEventIds: string[]) {
  let confirmationToken: string | undefined;
  const input = participantInputSchema.parse({
    firstName: form.get("firstName"),
    lastName: form.get("lastName"),
    phone: form.get("phone"),
    phoneCountry: form.get("phoneCountry"),
    email: form.get("email") ?? "",
    affiliation: form.get("affiliation") ?? "",
    affiliationOther: form.get("affiliationOther") ?? "",
    fitnessExperience: form.get("fitnessExperience") ?? "",
    eventIds: selectedEventIds,
    participationAcknowledged: form.get("participationAcknowledged"),
    dataUseAcknowledged: form.get("dataUseAcknowledged"),
  });
  const normalizedPhone = normalizePhone(input.phone, input.phoneCountry);
  const normalizedEmail = normalizeEmail(input.email ?? "");
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 500);
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipAddress =
    forwarded ??
    requestHeaders.get("x-real-ip") ??
    (process.env.NODE_ENV === "development" ? "127.0.0.1" : null);
  if (!userAgent || !ipAddress) throw new Error("registration evidence unavailable");
  const db = await createClient();
  const { data, error } = await db.rpc("register_selected_events", {
    p_first_name: input.firstName.trim(),
    p_last_name: input.lastName.trim(),
    p_display_phone: input.phone.trim(),
    p_normalized_phone: normalizedPhone.e164,
    p_phone_country: normalizedPhone.country,
    p_email: normalizedEmail,
    p_normalized_email: normalizedEmail,
    p_primary_affiliation_organization_id: input.affiliation || null,
    p_affiliation_other_text: input.affiliationOther || null,
    p_fitness_experience: input.fitnessExperience || null,
    p_event_ids: input.eventIds,
    p_participation_acknowledgment_version_id: String(form.get("participationVersionId")),
    p_data_use_acknowledgment_version_id: String(form.get("dataUseVersionId")),
    p_participation_acknowledged_at: new Date().toISOString(),
    p_data_use_acknowledged_at: new Date().toISOString(),
    p_ip_address: ipAddress,
    p_user_agent: userAgent,
    p_idempotency_key: String(form.get("idempotencyKey") || crypto.randomUUID()),
  } as never);
  if (error || !data) throw new Error("registration unavailable");
  const result = data as { confirmation_token?: string };
  if (!result.confirmation_token) throw new Error("submission already received");
  confirmationToken = result.confirmation_token;
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
    if (error instanceof Error && error.name === "ZodError")
      return { error: "Please correct the highlighted registration fields." };
    if (error instanceof Error && error.message.includes("valid phone"))
      return { error: error.message };
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
    const slug = assertPublicSlug(String(form.get("publicSlug") ?? ""));
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
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError")
      return { error: "Please correct the highlighted registration fields." };
    return { error: "This event is unavailable or registration could not be completed." };
  }
  redirect(`/registration/confirmation?token=${encodeURIComponent(confirmationToken)}`);
}

export { normalizeName };
