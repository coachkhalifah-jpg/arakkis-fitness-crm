"use server";

import {
  forgetRememberedParticipant,
  rememberParticipantFromConfirmation,
} from "@/lib/registration/device";

export type DeviceActionState = { error?: string; success?: string };

export async function rememberDeviceAction(_state: DeviceActionState, form: FormData) {
  const token = String(form.get("confirmationToken") ?? "");
  if (!token) return { error: "This confirmation link is no longer available." };
  try {
    const result = await rememberParticipantFromConfirmation(token);
    return result.error ? { error: result.error } : { success: "remembered" };
  } catch {
    return { error: "This browser could not be remembered. You can still book normally." };
  }
}

export async function forgetDeviceAction() {
  await forgetRememberedParticipant();
}
