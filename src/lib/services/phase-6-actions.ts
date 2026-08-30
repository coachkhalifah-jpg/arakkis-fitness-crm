"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { requireSystemAdmin } from "@/lib/authorization/server";
import { ZodError, z } from "zod";
import {
  canonicalizeContactText,
  canonicalizeName,
  normalizeEmail,
  normalizePhone,
} from "@/lib/registration/normalization";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export type ParticipantContactActionState = {
  error?: string;
  success?: string;
  reviewCaseId?: string;
};

const participantContactSchema = z.object({
  participantId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(1).max(40),
  phoneCountry: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2,3}$/),
  email: z.string().trim().max(254),
  reason: z.string().trim().min(1).max(500),
});

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/unauthorized|forbidden|unavailable/i.test(message)) return "This action is not authorized.";
  if (/email is invalid|email normalization/i.test(message)) return "Enter a valid email address.";
  if (/phone|correction input/i.test(message)) return "Enter valid participant contact details.";
  if (/unchanged/i.test(message)) return "Change at least one contact detail before saving.";
  if (/reason is required/i.test(message)) return "A reason is required.";
  if (/message is required/i.test(message)) return "A message is required.";
  if (/message is too long/i.test(message)) return "The message is too long.";
  if (/invalid snooze date/i.test(message)) return "Choose a future snooze date.";
  if (/outcome/i.test(message)) return "Select an approved completion outcome.";
  return "The follow-up action could not be completed.";
}

export async function correctParticipantContact(
  _state: ParticipantContactActionState,
  form: FormData,
): Promise<ParticipantContactActionState> {
  const participantId = value(form, "participantId");
  await requireSystemAdmin(`/admin/participants/${participantId}`);
  try {
    const input = participantContactSchema.parse({
      participantId,
      firstName: value(form, "firstName"),
      lastName: value(form, "lastName"),
      phone: value(form, "phone"),
      phoneCountry: value(form, "phoneCountry").toUpperCase(),
      email: value(form, "email"),
      reason: value(form, "reason"),
    });
    const firstName = canonicalizeName(input.firstName);
    const lastName = canonicalizeName(input.lastName);
    const displayPhone = canonicalizeContactText(input.phone);
    const normalizedPhone = normalizePhone(displayPhone, input.phoneCountry);
    let normalizedEmail: string | null;
    try {
      normalizedEmail = normalizeEmail(input.email);
    } catch (error) {
      if (error instanceof ZodError) throw new Error("email is invalid");
      throw error;
    }
    const db = await createClient();
    const { data, error } = await db.rpc("phase6_correct_participant_contact", {
      p_participant_id: input.participantId,
      p_first_name: firstName,
      p_last_name: lastName,
      p_display_phone: displayPhone,
      p_normalized_phone: normalizedPhone.e164,
      p_phone_country: normalizedPhone.country,
      p_email: normalizedEmail,
      p_normalized_email: normalizedEmail,
      p_reason: input.reason,
    } as never);
    if (error) throw new Error(error.message);
    const result = data as { status?: string; possible_duplicate_case_id?: string } | null;
    if (result?.status === "REVIEW_REQUIRED") {
      return {
        error:
          "This exact identity matches another Participant. A possible-duplicate review case was created; no contact details were changed.",
        reviewCaseId: result.possible_duplicate_case_id,
      };
    }
    revalidatePath("/admin/participants");
    revalidatePath(`/admin/participants/${input.participantId}`);
    return { success: "Participant contact details updated." };
  } catch (error) {
    if (error instanceof ZodError) return { error: "Enter valid participant contact details." };
    if (error instanceof Error && error.message.includes("valid phone")) {
      return { error: "Enter a valid phone number for the selected country." };
    }
    return { error: safeError(error) };
  }
}

export async function updateFollowUpMessage(form: FormData) {
  try {
    await requireSystemAdmin("/admin/community");
    const db = await createClient();
    const { error } = await db.rpc("phase6_update_follow_up_task", {
      p_task_id: value(form, "taskId"),
      p_suggested_message: value(form, "suggestedMessage"),
    } as never);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/community");
  } catch (error) {
    throw new Error(safeError(error));
  }
}

export async function recordFollowUpCopy(taskId: string) {
  await requireSystemAdmin("/admin/community");
  const db = await createClient();
  const { error } = await db.rpc("phase6_record_follow_up_copy", { p_task_id: taskId } as never);
  if (error) throw new Error(safeError(error));
  revalidatePath("/admin/community");
}

export async function completeFollowUpTask(form: FormData) {
  try {
    await requireSystemAdmin("/admin/community");
    const db = await createClient();
    const { error } = await db.rpc("phase6_complete_follow_up_task", {
      p_task_id: value(form, "taskId"),
      p_outcome: value(form, "outcome"),
      p_notes: value(form, "notes") || null,
    } as never);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/community");
    revalidatePath(`/admin/participants/${value(form, "participantId")}`);
  } catch (error) {
    throw new Error(safeError(error));
  }
}

export async function dismissFollowUpTask(form: FormData) {
  try {
    await requireSystemAdmin("/admin/community");
    const db = await createClient();
    const { error } = await db.rpc("phase6_dismiss_follow_up_task", {
      p_task_id: value(form, "taskId"),
      p_reason: value(form, "reason"),
    } as never);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/community");
  } catch (error) {
    throw new Error(safeError(error));
  }
}

export async function snoozeFollowUpTask(form: FormData) {
  try {
    await requireSystemAdmin("/admin/community");
    const dueAt = value(form, "dueAt");
    if (!dueAt || Number.isNaN(Date.parse(dueAt))) throw new Error("invalid snooze date");
    const db = await createClient();
    const { error } = await db.rpc("phase6_snooze_follow_up_task", {
      p_task_id: value(form, "taskId"),
      p_due_at: dueAt,
    } as never);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/community");
  } catch (error) {
    throw new Error(safeError(error));
  }
}

export async function updateGroupChatReminderMessage(form: FormData) {
  try {
    await requireSystemAdmin("/admin/community?mode=group");
    const db = await createClient();
    const { error } = await db.rpc("phase6_update_group_chat_reminder", {
      p_reminder_id: value(form, "reminderId"),
      p_suggested_message: value(form, "suggestedMessage"),
    } as never);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/community");
  } catch (error) {
    throw new Error(safeError(error));
  }
}

export async function recordGroupChatReminderCopy(reminderId: string) {
  await requireSystemAdmin("/admin/community?mode=group");
  const db = await createClient();
  const { error } = await db.rpc("phase6_record_group_chat_reminder_copy", {
    p_reminder_id: reminderId,
  } as never);
  if (error) throw new Error(safeError(error));
  revalidatePath("/admin/community");
}

export async function completeGroupChatReminder(form: FormData) {
  try {
    await requireSystemAdmin("/admin/community?mode=group");
    const db = await createClient();
    const { error } = await db.rpc("phase6_complete_group_chat_reminder", {
      p_reminder_id: value(form, "reminderId"),
      p_outcome: value(form, "outcome") || "CONTACTED",
      p_notes: value(form, "notes") || null,
    } as never);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/community");
  } catch (error) {
    throw new Error(safeError(error));
  }
}

export async function dismissGroupChatReminder(form: FormData) {
  try {
    await requireSystemAdmin("/admin/community?mode=group");
    const db = await createClient();
    const { error } = await db.rpc("phase6_dismiss_group_chat_reminder", {
      p_reminder_id: value(form, "reminderId"),
      p_reason: value(form, "reason"),
    } as never);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/community");
  } catch (error) {
    throw new Error(safeError(error));
  }
}

export async function snoozeGroupChatReminder(form: FormData) {
  try {
    await requireSystemAdmin("/admin/community?mode=group");
    const dueAt = value(form, "dueAt");
    if (!dueAt || Number.isNaN(Date.parse(dueAt))) throw new Error("invalid snooze date");
    const db = await createClient();
    const { error } = await db.rpc("phase6_snooze_group_chat_reminder", {
      p_reminder_id: value(form, "reminderId"),
      p_due_at: dueAt,
    } as never);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/community");
  } catch (error) {
    throw new Error(safeError(error));
  }
}

export async function assignFollowUpTask(form: FormData) {
  try {
    await requireSystemAdmin("/admin/community");
    const db = await createClient();
    const { error } = await db.rpc("phase6_assign_follow_up_task", {
      p_task_id: value(form, "taskId"),
      p_assigned_admin_id: value(form, "assignedAdminId"),
    } as never);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/community");
  } catch (error) {
    throw new Error(safeError(error));
  }
}
