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
  if (/outcome/i.test(message)) return "Select an approved completion outcome.";
  return "The follow-up action could not be completed.";
}

export async function updateFollowUpMessage(form: FormData) {
  try {
    await requireSystemAdmin("/admin/follow-ups");
    const db = await createClient();
    const { error } = await db.rpc("phase6_update_follow_up_task", {
      p_task_id: value(form, "taskId"),
      p_suggested_message: value(form, "suggestedMessage"),
    } as never);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/follow-ups");
  } catch (error) {
    throw new Error(safeError(error));
  }
}

export async function recordFollowUpCopy(taskId: string) {
  await requireSystemAdmin("/admin/follow-ups");
  const db = await createClient();
  const { error } = await db.rpc("phase6_record_follow_up_copy", { p_task_id: taskId } as never);
  if (error) throw new Error(safeError(error));
  revalidatePath("/admin/follow-ups");
}

export async function completeFollowUpTask(form: FormData) {
  try {
    await requireSystemAdmin("/admin/follow-ups");
    const db = await createClient();
    const { error } = await db.rpc("phase6_complete_follow_up_task", {
      p_task_id: value(form, "taskId"),
      p_outcome: value(form, "outcome"),
      p_notes: value(form, "notes") || null,
    } as never);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/follow-ups");
    revalidatePath(`/admin/participants/${value(form, "participantId")}`);
  } catch (error) {
    throw new Error(safeError(error));
  }
}

export async function dismissFollowUpTask(form: FormData) {
  try {
    await requireSystemAdmin("/admin/follow-ups");
    const db = await createClient();
    const { error } = await db.rpc("phase6_dismiss_follow_up_task", {
      p_task_id: value(form, "taskId"),
      p_reason: value(form, "reason"),
    } as never);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/follow-ups");
  } catch (error) {
    throw new Error(safeError(error));
  }
}

export async function assignFollowUpTask(form: FormData) {
  try {
    await requireSystemAdmin("/admin/follow-ups");
    const db = await createClient();
    const { error } = await db.rpc("phase6_assign_follow_up_task", {
      p_task_id: value(form, "taskId"),
      p_assigned_admin_id: value(form, "assignedAdminId"),
    } as never);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/follow-ups");
  } catch (error) {
    throw new Error(safeError(error));
  }
}
