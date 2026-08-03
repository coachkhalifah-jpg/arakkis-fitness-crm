"use server";

import { forgetRememberedParticipant } from "@/lib/registration/device";

export async function forgetDeviceAction() {
  await forgetRememberedParticipant();
}
