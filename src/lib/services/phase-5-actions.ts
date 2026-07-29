"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { requireActiveAdmin } from "@/lib/authorization/server";
import { normalizeEmail, normalizeName, normalizePhone } from "@/lib/registration/normalization";
import type { Phase3ActionState } from "@/lib/services/phase-3-actions";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const errorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  if (/capacity/i.test(message))
    return "Capacity reached. A System Admin may use an explicit override.";
  if (/finalized/i.test(message)) return "Attendance is finalized.";
  if (/unauthorized|forbidden|unavailable/i.test(message))
    return "This attendance action is not authorized.";
  if (/reason is required|correction reason/i.test(message))
    return "A reason is required for this correction.";
  if (/open/i.test(message)) return "Open check-in before recording attendance.";
  return "The attendance action could not be completed.";
};

async function invoke(form: FormData, rpc: string, args: Record<string, unknown>, success: string) {
  const id = value(form, "eventId");
  await requireActiveAdmin(`/admin/events/${id}`);
  const db = await createClient();
  const { error } = await db.rpc(rpc, args as never);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/events/${id}`);
  return { success };
}

export async function openAttendance(
  _state: Phase3ActionState,
  form: FormData,
): Promise<Phase3ActionState> {
  try {
    return await invoke(
      form,
      "phase5_open_attendance",
      { p_event_id: value(form, "eventId") },
      "Check-in is open.",
    );
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function finalizeAttendance(
  _state: Phase3ActionState,
  form: FormData,
): Promise<Phase3ActionState> {
  try {
    return await invoke(
      form,
      "phase5_finalize_attendance",
      { p_event_id: value(form, "eventId") },
      "Attendance finalized.",
    );
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function reopenAttendance(
  _state: Phase3ActionState,
  form: FormData,
): Promise<Phase3ActionState> {
  try {
    return await invoke(
      form,
      "phase5_reopen_attendance",
      { p_event_id: value(form, "eventId"), p_reason: value(form, "reason") },
      "Attendance reopened for correction.",
    );
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function markAttendance(
  _state: Phase3ActionState,
  form: FormData,
): Promise<Phase3ActionState> {
  try {
    const status = value(form, "status");
    if (!["ATTENDED", "NO_SHOW", "NOT_RECORDED", "EXCUSED"].includes(status))
      return { error: "Invalid attendance status." };
    return await invoke(
      form,
      "phase5_mark_attendance",
      {
        p_registration_id: value(form, "registrationId"),
        p_status: status,
        p_reason: value(form, "reason") || null,
      },
      "Attendance updated.",
    );
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function createWalkIn(
  _state: Phase3ActionState,
  form: FormData,
): Promise<Phase3ActionState> {
  const eventId = value(form, "eventId");
  try {
    const admin = await requireActiveAdmin(`/admin/events/${eventId}`);
    const phone = normalizePhone(value(form, "phone"), value(form, "phoneCountry") || "US");
    const email = normalizeEmail(value(form, "email"));
    const requestHeaders = await headers();
    const db = await createClient();
    const { data, error } = await db.rpc("phase5_create_walk_in", {
      p_event_id: eventId,
      p_first_name: value(form, "firstName"),
      p_last_name: value(form, "lastName"),
      p_display_phone: value(form, "phone"),
      p_normalized_phone: phone.e164,
      p_phone_country: phone.country,
      p_email: email,
      p_normalized_email: email,
      p_affiliation_organization_id: value(form, "affiliation") || null,
      p_affiliation_other_text: value(form, "affiliationOther") || null,
      p_participation_acknowledgment_version_id: value(form, "participationVersionId"),
      p_data_use_acknowledgment_version_id: value(form, "dataUseVersionId"),
      p_ip_address: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
      p_user_agent: requestHeaders.get("user-agent")?.slice(0, 500) || "local-admin",
      p_over_capacity_reason:
        admin.role === "SYSTEM_ADMIN" ? value(form, "overrideReason") || null : null,
    } as never);
    if (error || !data) throw new Error(error?.message || "walk-in failed");
    revalidatePath(`/admin/events/${eventId}`);
    return { success: "Walk-in checked in." };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function openAttendanceSubmit(form: FormData): Promise<void> {
  await openAttendance({}, form);
}
export async function finalizeAttendanceSubmit(form: FormData): Promise<void> {
  await finalizeAttendance({}, form);
}
export async function reopenAttendanceSubmit(form: FormData): Promise<void> {
  await reopenAttendance({}, form);
}
export async function markAttendanceSubmit(form: FormData): Promise<void> {
  await markAttendance({}, form);
}
export async function createWalkInSubmit(form: FormData): Promise<void> {
  await createWalkIn({}, form);
}

export { normalizeName };
