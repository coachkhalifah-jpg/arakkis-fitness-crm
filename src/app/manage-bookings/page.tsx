import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getManagedBookings } from "@/lib/registration/booking-management";
import { cancelBookingAction, restoreBookingAction } from "@/lib/registration/booking-actions";

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  }).format(new Date(value));
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

export default async function ManageBookingsPage() {
  const result = await getManagedBookings();
  if (!result)
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <Card className="p-7">
          <h1 className="text-2xl font-semibold">Manage My Bookings</h1>
          <p className="mt-3 text-slate-600">
            This booking link is unavailable or has expired. Save this device from a recent
            confirmation to continue.
          </p>
          <Link className="mt-5 inline-block font-semibold text-brand underline" href="/events">
            Browse classes
          </Link>
        </Card>
      </main>
    );
  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Welcome back</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">Manage My Bookings</h1>
      <p className="mt-2 text-slate-600">Each date is managed independently.</p>
      <div className="mt-7 space-y-4">
        {result.bookings.length === 0 ? (
          <Card className="p-6">You have no upcoming bookings.</Card>
        ) : (
          result.bookings.map((booking) => (
            <Card key={booking.registration_id} className="p-6">
              <h2 className="text-xl font-semibold">{booking.name}</h2>
              <p className="mt-2 font-medium">{formatDate(booking.starts_at, booking.timezone)}</p>
              <p className="text-slate-600">
                {formatTime(booking.starts_at, booking.timezone)}–
                {formatTime(booking.ends_at, booking.timezone)}
              </p>
              <p className="mt-3 text-slate-700">
                {booking.venue_name}
                <br />
                {booking.venue_street}, {booking.venue_city}, {booking.venue_state}{" "}
                {booking.venue_postal_code}
              </p>
              {booking.location_updated ? (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                  Location updated — this occurrence uses its current venue.
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
                  href={`/manage-bookings/${booking.registration_id}`}
                >
                  Manage Booking
                </Link>
                {booking.registration_outcome === "PARTICIPANT_CANCELLED" ? (
                  <form action={restoreBookingAction}>
                    <input type="hidden" name="registrationId" value={booking.registration_id} />
                    <button
                      className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
                      type="submit"
                    >
                      Restore Booking
                    </button>
                  </form>
                ) : (
                  <form action={cancelBookingAction}>
                    <input type="hidden" name="registrationId" value={booking.registration_id} />
                    <button
                      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold"
                      type="submit"
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
      <Link className="mt-7 inline-block font-semibold text-brand underline" href="/events">
        Book another class
      </Link>
      <Link
        className="ml-5 inline-block font-semibold text-brand underline"
        href="/legal/cancellation"
      >
        Cancellation &amp; Refund Policy
      </Link>
    </main>
  );
}
