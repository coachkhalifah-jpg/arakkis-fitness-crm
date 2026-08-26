import Link from "next/link";
import type { ManagedBooking } from "@/lib/registration/booking-management";
import { CancelBookingDialog } from "@/components/registration/cancel-booking-dialog";

function dateParts(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  }).formatToParts(new Date(value));
  return {
    weekday: parts.find((part) => part.type === "weekday")?.value ?? "",
    day: parts.find((part) => part.type === "day")?.value ?? "",
    month: parts.find((part) => part.type === "month")?.value ?? "",
  };
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function formatVenue(booking: ManagedBooking) {
  return `${booking.venue_name} · ${booking.venue_city}, ${booking.venue_state}`;
}

function LocationIcon() {
  return (
    <span className="mr-1 inline-flex align-[-0.125em]" aria-hidden="true">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-3.5 w-3.5"
      >
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    </span>
  );
}

export function UpNextBookingCard({ booking }: { booking: ManagedBooking }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_14px_36px_rgba(10,12,15,0.18)]">
      <Link
        href={`/manage-bookings/${booking.registration_id}`}
        className="group block p-6 text-left transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">{booking.name}</h2>
          </div>
          <span
            aria-hidden="true"
            className="shrink-0 text-2xl text-[var(--foreground-muted)] transition-colors group-hover:text-ink"
          >
            ›
          </span>
        </div>
        <p className="mt-5 font-semibold text-ink">
          {new Intl.DateTimeFormat("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            timeZone: booking.timezone,
          }).format(new Date(booking.starts_at))}
        </p>
        <p className="mt-1 text-[var(--foreground-muted)]">
          {formatTime(booking.starts_at, booking.timezone)}–
          {formatTime(booking.ends_at, booking.timezone)}
        </p>
        <p className="mt-4 text-sm text-[var(--foreground-muted)]">
          <LocationIcon />
          {formatVenue(booking)}
        </p>
        {booking.location_updated ? (
          <p className="mt-3 text-xs font-semibold text-amber-700">Location updated</p>
        ) : null}
      </Link>
      <div className="flex justify-end px-4 py-0.5 sm:px-5">
        <CancelBookingDialog booking={booking} />
      </div>
    </div>
  );
}

export function BookingScheduleList({ bookings }: { bookings: ManagedBooking[] }) {
  return (
    <section
      className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
      aria-label="My bookings"
    >
      {bookings.map((booking, index) => {
        const date = dateParts(booking.starts_at, booking.timezone);
        return (
          <div
            key={booking.registration_id}
            className={index > 0 ? "border-t border-[var(--border)]" : ""}
          >
            <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:gap-4 sm:px-5">
              <Link
                href={`/manage-bookings/${booking.registration_id}`}
                aria-label={`View booking details for ${booking.name}`}
                className="col-span-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:gap-4"
              >
                <div className="flex w-12 shrink-0 flex-col items-center justify-center text-center leading-none sm:w-14">
                  <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
                    {date.weekday}
                  </span>
                  <span className="my-0.5 text-2xl font-bold tracking-tight text-ink">
                    {date.day}
                  </span>
                  <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
                    {date.month}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{booking.name}</p>
                  <p className="mt-0.5 text-sm text-[var(--foreground-muted)]">
                    {formatTime(booking.starts_at, booking.timezone)}–
                    {formatTime(booking.ends_at, booking.timezone)}
                  </p>
                  <p className="mt-0.5 flex min-w-0 items-center truncate text-sm text-[var(--foreground-muted)]">
                    <LocationIcon />
                    <span className="truncate">{formatVenue(booking)}</span>
                  </p>
                  {booking.location_updated ? (
                    <p className="mt-1 text-xs font-semibold text-amber-700">Location updated</p>
                  ) : null}
                </div>
              </Link>
              <div className="flex flex-col items-center justify-center">
                <Link
                  href={`/manage-bookings/${booking.registration_id}`}
                  aria-label={`View details for ${booking.name}`}
                  className="flex min-h-11 min-w-11 items-center justify-center text-xl text-[var(--foreground-muted)] transition-colors hover:text-ink focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                >
                  <span aria-hidden="true">›</span>
                </Link>
                <CancelBookingDialog booking={booking} label="Cancel" />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
