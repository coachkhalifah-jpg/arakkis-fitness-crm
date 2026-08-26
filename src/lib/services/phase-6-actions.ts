"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { requireSystemAdmin } from "@/lib/authorization/server";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/unauthorized|forbidden|unavailable/i.test(message)) return "This action is not authorized.";
  if (/reason is required/i.test(message)) return "A reason is required.";
  if (/message is required/i.test(message)) return "A message is required.";
  if (/message is too long/i.test(message)) return "The message is too long.";
  if (/invalid snooze date/i.test(message)) return "Choose a future snooze date.";
  if (/outcome/i.test(message)) return "Select an approved completion outcome.";
  return "The follow-up action could not be completed.";
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
