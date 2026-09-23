import type { ManagedBooking } from "@/lib/registration/booking-management";

/** Active REGISTERED bookings keyed by event occurrence id. */
export function activeRegistrationIdByEventId(
  bookings: ManagedBooking[] | null | undefined,
): Map<string, string> {
  return new Map(
    (bookings ?? [])
      .filter(
        (booking) =>
          booking.registration_status === "REGISTERED" && booking.registration_outcome === "ACTIVE",
      )
      .map((booking) => [booking.event_id, booking.registration_id]),
  );
}

export function manageBookingHref(registrationId: string) {
  return `/manage-bookings/${encodeURIComponent(registrationId)}`;
}
