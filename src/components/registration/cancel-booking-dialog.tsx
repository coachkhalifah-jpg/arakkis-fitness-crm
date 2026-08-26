"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ManagedBooking } from "@/lib/registration/booking-management";
import { cancelBookingAction } from "@/lib/registration/booking-actions";
import type { BookingActionError } from "@/lib/registration/booking-management";

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

export function CancelBookingDialog({
  booking,
  label = "Cancel booking",
  accessToken,
  className,
}: {
  booking: ManagedBooking;
  label?: string;
  accessToken?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<BookingActionError | undefined, FormData>(
    cancelBookingAction,
    undefined,
  );
  const keepButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    keepButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`min-h-11 min-w-11 px-3 text-sm font-bold text-[var(--foreground-muted)] underline underline-offset-4 transition-colors hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${className ?? ""}`}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 text-left shadow-2xl sm:p-7"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-booking-title"
            aria-describedby="cancel-booking-description"
          >
            <h2 id="cancel-booking-title" className="text-2xl font-semibold text-ink">
              Cancel this class?
            </h2>
            <div className="mt-4 space-y-1 text-sm text-[var(--foreground-muted)]">
              <p className="font-semibold text-ink">{booking.name}</p>
              <p>
                {formatDate(booking.starts_at, booking.timezone)} ·{" "}
                {formatTime(booking.starts_at, booking.timezone)}
              </p>
              <p>
                {booking.venue_name} · {booking.venue_city}, {booking.venue_state}
              </p>
            </div>
            <p
              id="cancel-booking-description"
              className="mt-5 text-sm text-[var(--foreground-muted)]"
            >
              Your spot will become available to someone else.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                ref={keepButtonRef}
                type="button"
                className="min-h-11 rounded-full border border-[var(--border)] px-4 text-sm font-semibold text-ink transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                onClick={() => setOpen(false)}
              >
                Keep my booking
              </button>
              <form action={action}>
                <input type="hidden" name="registrationId" value={booking.registration_id} />
                {accessToken ? (
                  <input type="hidden" name="accessToken" value={accessToken} />
                ) : null}
                <button
                  type="submit"
                  disabled={pending}
                  className="min-h-11 rounded-full border border-red-700 px-4 text-sm font-bold text-red-700 transition-colors hover:bg-red-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                >
                  {pending ? "Cancelling…" : "Cancel booking"}
                </button>
              </form>
            </div>
            {state?.error ? (
              <p className="mt-4 text-sm font-medium text-red-700" role="alert">
                {state.error}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
