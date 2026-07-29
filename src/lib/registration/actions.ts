"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import {
  normalizeEmail,
  normalizeName,
  normalizePhone,
  participantInputSchema,
} from "@/lib/registration/normalization";

export type RegistrationActionState = { error?: string };

export async function submitRegistration(
  _state: RegistrationActionState,
  form: FormData,
): Promise<RegistrationActionState> {
  try {
    const selectedEventIds = [...new Set(form.getAll("eventIds").map(String))];
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
    if (!userAgent || !ipAddress)
      return { error: "The registration could not be submitted. Please try again." };
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
    if (error || !data)
      return {
        error: "The registration could not be completed. Please review the form and try again.",
      };
    const result = data as { confirmation_token?: string; results?: Array<{ success: boolean }> };
    if (!result.confirmation_token)
      return {
        error: "This submission was already received. Please return to your confirmation link.",
      };
    redirect(`/registration/confirmation?token=${encodeURIComponent(result.confirmation_token)}`);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError")
      return { error: "Please correct the highlighted registration fields." };
    if (error instanceof Error && error.message.includes("valid phone"))
      return { error: error.message };
    return { error: "The registration could not be completed. Please try again." };
  }
}

export { normalizeName };
