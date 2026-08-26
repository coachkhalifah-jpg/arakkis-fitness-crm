import type { ManagedBooking } from "@/lib/registration/booking-management";

export function isActiveManagedBooking(booking: ManagedBooking) {
  return booking.registration_status === "REGISTERED" && booking.registration_outcome === "ACTIVE";
}

export function splitManagedBookings(bookings: ManagedBooking[]) {
  const ordered = [...bookings].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );
  const active = ordered.filter(isActiveManagedBooking);

  return {
    upNext: active[0] ?? null,
    remainingActive: active.slice(1),
    cancelled: ordered.filter((booking) => !isActiveManagedBooking(booking)),
  };
}
