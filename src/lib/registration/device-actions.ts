"use server";

import { revalidatePath } from "next/cache";
import { forgetRememberedParticipant } from "@/lib/registration/device";

export async function forgetDeviceAction() {
  await forgetRememberedParticipant();
  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath("/manage-bookings");
}
