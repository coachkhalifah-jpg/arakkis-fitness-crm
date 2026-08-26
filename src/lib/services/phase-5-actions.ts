"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { requireActiveAdmin } from "@/lib/authorization/server";
import { normalizeEmail, normalizeName, normalizePhone } from "@/lib/registration/normalization";
import type { Phase3ActionState } from "@/lib/services/phase-3-actions";
import { mapAttendanceError } from "@/lib/services/attendance-errors";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

const errorState = (error: unknown) => {
  const mapped = mapAttendanceError(error);
  return { error: mapped.message, errorAction: mapped.nextAction, errorCode: mapped.code };
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
    return errorState(error);
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
    return errorState(error);
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
    return errorState(error);
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
    return errorState(error);
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
    const [{ data: participationVersion }, { data: dataUseVersion }] = await Promise.all([
      db.rpc("phase5_current_acknowledgment_version", { p_type: "PARTICIPATION_RISK" } as never),
      db.rpc("phase5_current_acknowledgment_version", { p_type: "DATA_USE" } as never),
    ]);
    if (!participationVersion || !dataUseVersion)
      throw new Error("required acknowledgment unavailable");
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
      p_participation_acknowledgment_version_id: participationVersion,
      p_data_use_acknowledgment_version_id: dataUseVersion,
      p_ip_address: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
      p_user_agent: requestHeaders.get("user-agent")?.slice(0, 500) || "local-admin",
      p_over_capacity_reason:
        admin.role === "SYSTEM_ADMIN" ? value(form, "overrideReason") || null : null,
    } as never);
    if (error) throw error;
    if (!data) throw new Error("walk-in failed");
    revalidatePath(`/admin/events/${eventId}`);
    return { success: "Walk-in checked in." };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[attendance] walk-in action failed", {
        code: typeof error === "object" && error !== null && "code" in error ? error.code : null,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return errorState(error);
  }
}

export async function saveAttendanceChanges(
  _state: Phase3ActionState,
  form: FormData,
): Promise<Phase3ActionState> {
  const eventId = value(form, "eventId");
  try {
    await requireActiveAdmin(`/admin/events/${eventId}`);
    const rawChanges = value(form, "changes");
    const changes = JSON.parse(rawChanges) as unknown;
    if (
      !Array.isArray(changes) ||
      changes.some((change) => typeof change !== "object" || change === null)
    ) {
      return { error: "Attendance changes are invalid." };
    }
    const db = await createClient();
    const { error } = await db.rpc("phase5_save_attendance_changes", {
      p_event_id: eventId,
      p_changes: changes,
    } as never);
    if (error) throw error;
    revalidatePath(`/admin/events/${eventId}`);
    return { success: "Attendance changes saved." };
  } catch (error) {
    return errorState(error);
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
export async function removeRegistrationFromRoster(
  _state: Phase3ActionState,
  form: FormData,
): Promise<Phase3ActionState> {
  const eventId = value(form, "eventId");
  try {
    await requireActiveAdmin(`/admin/events/${eventId}`);
    const registrationId = value(form, "registrationId");
    if (!registrationId) return { error: "A registration is required." };
    const db = await createClient();
    const { error } = await db.rpc("phase5_remove_registration_from_roster", {
      p_registration_id: registrationId,
    } as never);
    if (error) throw error;
    revalidatePath("/admin/events");
    revalidatePath(`/admin/events/${eventId}`);
    return { success: "Registration removed from roster." };
  } catch (error) {
    return errorState(error);
  }
}
export async function createWalkInSubmit(form: FormData): Promise<void> {
  await createWalkIn({}, form);
}

export { normalizeName };
