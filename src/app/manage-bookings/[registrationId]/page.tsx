import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getBookingAlternatives, getManagedBookings } from "@/lib/registration/booking-management";
import {
  cancelBookingAction,
  restoreBookingAction,
  transferBookingAction,
} from "@/lib/registration/booking-actions";

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ registrationId: string }>;
}) {
  const { registrationId } = await params;
  const result = await getManagedBookings();
  const booking = result?.bookings.find((item) => item.registration_id === registrationId);
  const alternatives = booking ? await getBookingAlternatives(registrationId) : null;
  if (!booking)
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <Card className="p-7">
          Booking not found.{" "}
          <Link className="text-brand underline" href="/manage-bookings">
            Back to bookings
          </Link>
        </Card>
      </main>
    );
  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-10">
      <Link className="text-sm font-semibold text-brand underline" href="/manage-bookings">
        Back to bookings
      </Link>
      <Link className="ml-5 text-sm font-semibold text-brand underline" href="/legal/cancellation">
        Cancellation &amp; Refund Policy
      </Link>
      <Card className="mt-5 p-6">
        <h1 className="text-2xl font-semibold">{booking.name}</h1>
        <p className="mt-3">
          {new Intl.DateTimeFormat("en-US", {
            dateStyle: "full",
            timeZone: booking.timezone,
          }).format(new Date(booking.starts_at))}
        </p>
        <p className="text-slate-600">
          {new Intl.DateTimeFormat("en-US", {
            timeStyle: "short",
            timeZone: booking.timezone,
          }).format(new Date(booking.starts_at))}
        </p>
        <p className="mt-3">
          {booking.venue_name}
          <br />
          {booking.venue_street}, {booking.venue_city}, {booking.venue_state}{" "}
          {booking.venue_postal_code}
        </p>
        {booking.location_updated ? (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Location updated</strong>
            <br />
            This location changed after you booked. Use the current venue above.
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <form action={cancelBookingAction}>
            <input type="hidden" name="registrationId" value={registrationId} />
            <button
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold"
              type="submit"
            >
              Continue cancelling
            </button>
          </form>
          {booking.registration_outcome === "PARTICIPANT_CANCELLED" ? (
            <form action={restoreBookingAction}>
              <input type="hidden" name="registrationId" value={registrationId} />
              <button
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
                type="submit"
              >
                Restore Booking
              </button>
            </form>
          ) : null}
        </div>
      </Card>
      {alternatives?.length ? (
        <section className="mt-7">
          <h2 className="text-xl font-semibold">Choose another date</h2>
          <p className="mt-1 text-sm text-slate-600">Eligible alternatives in the next 14 days.</p>
          <div className="mt-4 space-y-3">
            {alternatives.map((alternative) => (
              <Card key={String(alternative.event_id)} className="p-5">
                <p className="font-semibold">
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "full",
                    timeZone: String(alternative.timezone),
                  }).format(new Date(String(alternative.starts_at)))}
                </p>
                <p className="text-slate-600">
                  {String(alternative.venue_name)} ·{" "}
                  {new Intl.DateTimeFormat("en-US", {
                    timeStyle: "short",
                    timeZone: String(alternative.timezone),
                  }).format(new Date(String(alternative.starts_at)))}
                </p>
                <form action={transferBookingAction} className="mt-3">
                  <input type="hidden" name="registrationId" value={registrationId} />
                  <input type="hidden" name="targetEventId" value={String(alternative.event_id)} />
                  <button
                    className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
                    type="submit"
                  >
                    Move booking
                  </button>
                </form>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
