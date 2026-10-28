"use client";

import { useActionState, useState } from "react";
import { transferBookingAction } from "@/lib/registration/booking-actions";
import type {
  BookingActionError,
  BookingAlternative,
  ManagedBooking,
} from "@/lib/registration/booking-management";
import { formatInTimezone } from "@/lib/registration/datetime";

function formatDate(value: string, timezone: string) {
  return formatInTimezone(value, timezone, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(value: string, timezone: string) {
  return formatInTimezone(value, timezone, {
    hour: "numeric",
    minute: "2-digit",
  });
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
  const [targetEventId, setTargetEventId] = useState("");
  const canMove = targetEventId.length > 0;

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
        <select
          id="target-event-id"
          name="targetEventId"
          value={targetEventId}
          onChange={(event) => setTargetEventId(event.target.value)}
        >
          <option value="">Select a date</option>
          {alternatives.map((alternative) => (
            <option key={alternative.event_id} value={alternative.event_id}>
              {formatDate(alternative.starts_at, alternative.timezone)} ·{" "}
              {formatTime(alternative.starts_at, alternative.timezone)} · {alternative.venue_name}
            </option>
          ))}
        </select>
        {canMove ? (
          <button type="submit" className="manage-booking-detail-secondary" disabled={pending}>
            {pending ? "Moving booking…" : "Move booking"}
          </button>
        ) : null}
      </form>
      {state?.error ? <p role="alert">{state.error}</p> : null}
    </section>
  );
}
