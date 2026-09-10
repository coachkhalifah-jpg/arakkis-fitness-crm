"use client";

import { useActionState } from "react";
import { transferBookingAction } from "@/lib/registration/booking-actions";
import type {
  BookingActionError,
  BookingAlternative,
  ManagedBooking,
} from "@/lib/registration/booking-management";

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

export function TransferBookingDialog({
  booking,
  alternatives,
  accessToken,
}: {
  booking: ManagedBooking;
  alternatives: BookingAlternative[];
  accessToken?: string;
}) {
  const [state, action, pending] = useActionState<BookingActionError | undefined, FormData>(
    transferBookingAction,
    undefined,
  );

  return (
    <section className="manage-booking-transfer" aria-labelledby="transfer-booking-title">
      <h2 id="transfer-booking-title">Choose another class in this series</h2>
      <p>
        Move this booking to an available upcoming occurrence. Your current spot is released only
        after the new booking is secured.
      </p>
      <form action={action}>
        <input type="hidden" name="registrationId" value={booking.registration_id} />
        {accessToken ? <input type="hidden" name="accessToken" value={accessToken} /> : null}
        <label htmlFor="target-event-id">Available occurrences</label>
        <select id="target-event-id" name="targetEventId" required defaultValue="">
          <option value="" disabled>
            Select a date
          </option>
          {alternatives.map((alternative) => (
            <option key={alternative.event_id} value={alternative.event_id}>
              {formatDate(alternative.starts_at, alternative.timezone)} ·{" "}
              {formatTime(alternative.starts_at, alternative.timezone)} · {alternative.venue_name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending}>
          {pending ? "Moving booking…" : "Move booking"}
        </button>
      </form>
      {state?.error ? <p role="alert">{state.error}</p> : null}
    </section>
  );
}
