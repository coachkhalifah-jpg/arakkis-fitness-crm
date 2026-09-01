import Link from "next/link";
import {
  getBookingAlternatives,
  getManagedBookings,
  getScopedBooking,
} from "@/lib/registration/booking-management";
import { CancelBookingDialog } from "@/components/registration/cancel-booking-dialog";
import { TransferBookingDialog } from "@/components/registration/transfer-booking-dialog";
import { PublicErrorState } from "@/components/registration/public-error-state";
import { googleMapsDirectionsUrl } from "@/lib/registration/maps";
import {
  isHostedAccessCorrelationId,
  logHostedAccessDiagnostic,
} from "@/lib/diagnostics/hosted-access";

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

export default async function ManageBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ registrationId: string }>;
  searchParams: Promise<{ token?: string; confirmationToken?: string; correlationId?: string }>;
}) {
  const { registrationId } = await params;
  const routeSearchParams = await searchParams;
  const correlationId = isHostedAccessCorrelationId(routeSearchParams.correlationId)
    ? routeSearchParams.correlationId
    : crypto.randomUUID();
  const confirmationToken = (
    routeSearchParams.token ??
    routeSearchParams.confirmationToken ??
    ""
  ).trim();
  const scopedBooking = confirmationToken
    ? await getScopedBooking(registrationId, confirmationToken, correlationId)
    : null;
  const result = scopedBooking ? null : await getManagedBookings(correlationId);
  const booking =
    scopedBooking ?? result?.bookings.find((item) => item.registration_id === registrationId);
  if (!booking) {
    logHostedAccessDiagnostic({
      correlation_id: correlationId,
      boundary: "booking_management",
      outcome_category: "data_state_failure",
      registration_match: false,
      booking_result: "not_found",
    });
    return (
      <PublicErrorState
        code="404"
        title="Booking could not be found."
        message="This booking may no longer be available or the link may be invalid."
        actionLabel="Back to bookings"
        actionHref="/manage-bookings"
      />
    );
  }
  logHostedAccessDiagnostic({
    correlation_id: correlationId,
    boundary: "booking_management",
    outcome_category: "success",
    registration_match: true,
    booking_result: "resolved",
  });
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: booking.timezone,
  })
    .format(new Date(booking.starts_at))
    .replace(",", " ·");
  const address = `${booking.venue_street}, ${booking.venue_city}, ${booking.venue_state} ${booking.venue_postal_code}`;
  const directionsUrl = googleMapsDirectionsUrl(address);
  const correlationQuery = `&correlationId=${encodeURIComponent(correlationId)}`;
  const confirmationHref = confirmationToken
    ? `/registration/confirmation?token=${encodeURIComponent(confirmationToken)}${correlationQuery}`
    : `/manage-bookings/confirmation?registrationId=${encodeURIComponent(registrationId)}`;
  const alternatives =
    booking.registration_status === "REGISTERED" && booking.registration_outcome === "ACTIVE"
      ? await getBookingAlternatives(registrationId, confirmationToken || undefined)
      : null;
  return (
    <main className="manage-booking-detail-page">
      <header className="manage-booking-detail-header">
        <Link href="/manage-bookings" className="manage-booking-detail-back">
          ← Back to manage bookings
        </Link>
        <p className="manage-booking-detail-kicker">Booking detail</p>
      </header>

      <section className="manage-booking-detail-hero" aria-labelledby="manage-booking-detail-title">
        <p className="manage-booking-detail-organization">{booking.host_organization_name}</p>
        <h1 id="manage-booking-detail-title">{booking.name}</h1>
        <p className="manage-booking-detail-status">Confirmed booking</p>
      </section>

      <section className="manage-booking-detail-facts" aria-label="Booking details">
        <p>{dateLabel}</p>
        <p>{formatTime(booking.starts_at, booking.timezone)}</p>
        <p className="manage-booking-detail-venue">
          {booking.venue_name}
          <br />
          {booking.venue_street}, {booking.venue_city}, {booking.venue_state}
        </p>
        {booking.location_updated ? (
          <p className="manage-booking-detail-location-note">
            Location updated — use the current venue above.
          </p>
        ) : null}
      </section>

      {booking.participant_instructions ? (
        <section
          className="manage-booking-detail-prep"
          aria-labelledby="manage-booking-detail-prep-title"
        >
          <h2 id="manage-booking-detail-prep-title">Before you arrive</h2>
          <p>{booking.participant_instructions}</p>
        </section>
      ) : null}

      <div className="manage-booking-detail-actions">
        {directionsUrl ? (
          <a
            className="manage-booking-detail-primary"
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
          >
            Get directions <span aria-hidden="true">↗</span>
          </a>
        ) : null}
        <Link className="manage-booking-detail-secondary" href={confirmationHref}>
          Open confirmation
        </Link>
        <Link className="manage-booking-detail-secondary" href="/events">
          Browse more classes
        </Link>
        {alternatives?.length ? (
          <TransferBookingDialog
            booking={booking}
            alternatives={alternatives}
            accessToken={confirmationToken || undefined}
          />
        ) : null}
        <CancelBookingDialog
          booking={booking}
          label="Cancel booking"
          accessToken={confirmationToken || undefined}
          className="manage-booking-detail-cancel"
        />
      </div>
    </main>
  );
}
