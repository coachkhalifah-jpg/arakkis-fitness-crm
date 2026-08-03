"use server";

import { revalidatePath } from "next/cache";
import { manageBooking } from "@/lib/registration/booking-management";

export async function cancelBookingAction(form: FormData) {
  const result = await manageBooking("CANCEL", String(form.get("registrationId") ?? ""));
  revalidatePath("/events");
  revalidatePath("/manage-bookings");
  void result;
}

export async function restoreBookingAction(form: FormData) {
  const result = await manageBooking("RESTORE", String(form.get("registrationId") ?? ""));
  revalidatePath("/events");
  revalidatePath("/manage-bookings");
  void result;
}

export async function transferBookingAction(form: FormData) {
  const result = await manageBooking(
    "TRANSFER",
    String(form.get("registrationId") ?? ""),
    String(form.get("targetEventId") ?? ""),
  );
  revalidatePath("/events");
  revalidatePath("/manage-bookings");
  void result;
}
