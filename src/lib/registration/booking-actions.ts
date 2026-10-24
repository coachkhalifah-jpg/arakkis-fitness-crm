"use server";

import { revalidatePath } from "next/cache";
import { manageBooking } from "@/lib/registration/booking-management";
import type { BookingActionError } from "@/lib/registration/booking-management";

/** Bound for useActionState — success must differ from the initial state so pending clears. */
export type CancelBookingActionState = {
  error?: string;
  success?: boolean;
};

export async function cancelBookingAction(
  _state: CancelBookingActionState,
  form: FormData,
): Promise<CancelBookingActionState> {
  const registrationId = String(form.get("registrationId") ?? "");
  const result = await manageBooking(
    "CANCEL",
    registrationId,
    undefined,
    String(form.get("accessToken") ?? "") || undefined,
  );
  if (typeof result.error === "string") return { error: result.error };
  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath("/manage-bookings");
  if (registrationId) {
    revalidatePath(`/manage-bookings/${registrationId}`);
  }
  return { success: true };
}

export async function restoreBookingAction(
  _state: BookingActionError | undefined,
  form: FormData,
): Promise<BookingActionError | undefined> {
  const result = await manageBooking(
    "RESTORE",
    String(form.get("registrationId") ?? ""),
    undefined,
    String(form.get("accessToken") ?? "") || undefined,
  );
  if (typeof result.error === "string") return { error: result.error };
  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath("/manage-bookings");
  return undefined;
}

export async function transferBookingAction(
  _state: BookingActionError | undefined,
  form: FormData,
): Promise<BookingActionError | undefined> {
  const result = await manageBooking(
    "TRANSFER",
    String(form.get("registrationId") ?? ""),
    String(form.get("targetEventId") ?? ""),
    String(form.get("accessToken") ?? "") || undefined,
  );
  if (typeof result.error === "string") return { error: result.error };
  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath("/manage-bookings");
  return undefined;
}
