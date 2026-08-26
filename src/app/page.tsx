import Image from "next/image";
import Link from "next/link";
import { CancelBookingDialog } from "@/components/registration/cancel-booking-dialog";
import type { ManagedBooking } from "@/lib/registration/booking-management";
import { getManagedBookings } from "@/lib/registration/booking-management";
import { resolveRememberedParticipant } from "@/lib/registration/device";
import { splitManagedBookings } from "@/lib/registration/booking-presentation";
import { ScrollTurningLine } from "@/components/home/scroll-turning-line";
import { PublicLandingGooeyTitle } from "@/components/home/public-landing-gooey-title";

function formatDate(value: string, timezone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: timezone }).format(
    new Date(value),
  );
}

function formatTime(value: string, timezone: string) {
  return formatDate(value, timezone, { hour: "numeric", minute: "2-digit" });
}

function HomeNavigation() {
  return (
    <nav className="home-nav" aria-label="Public navigation">
      <Link className="home-mark" href="/" aria-label="Arakkis home">
        ARAKKIS
      </Link>
      <Link className="home-admin-link" href="/admin/sign-in">
        Admin Sign In <span aria-hidden="true">↗</span>
      </Link>
    </nav>
  );
}

function PublicLandingPage() {
  return (
    <div className="home-page">
      <HomeNavigation />
      <main>
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <p className="home-kicker">01 / COME AS YOU ARE</p>
            <PublicLandingGooeyTitle />
            <p className="home-lede">
              Arakkis brings together the right space, the right class, and the right people so
              showing up feels like being part of something.
            </p>
            <div className="home-actions">
              <Link className="home-primary" href="/events">
                Browse Events <span aria-hidden="true">↗</span>
              </Link>
              <Link className="home-secondary" href="/manage-bookings">
                Manage your booking <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>

          <div className="home-hero-visual">
            <div className="home-image-frame">
              <Image
                src="/admin-assets/page-backgrounds/workspace.jpg"
                alt="A person moving through an urban space"
                fill
                priority
                sizes="(max-width: 900px) 88vw, 40vw"
              />
            </div>
            <div className="home-image-caption" aria-hidden="true">
              <span>Arakkis / Movement in practice</span>
              <span>Public portal</span>
            </div>
            <p className="home-side-note">
              A living calendar
              <br />
              for better gatherings.
            </p>
          </div>
        </section>

        <section className="home-guidance" aria-labelledby="home-guidance-title">
          <p className="home-kicker">What can I do here?</p>
          <h2 id="home-guidance-title">
            Find an event.
            <br />
            <em>Find your people.</em>
          </h2>
          <p>
            Browse upcoming classes and community gatherings, choose a time that works, and keep
            your booking close. Start with Events, or manage a booking you already made.
          </p>
        </section>
      </main>

      <footer className="home-footer">
        <span>Arakkis / Public portal</span>
        <span className="home-footer-accent">Make room for what matters.</span>
      </footer>
    </div>
  );
}

function ReturningBookingCard({ booking }: { booking: ManagedBooking }) {
  return (
    <article className="booking-list-item">
      <div className="booking-date-treatment" aria-label="Event date">
        <b>{formatDate(booking.starts_at, booking.timezone, { weekday: "short" })}</b>
        <strong>{formatDate(booking.starts_at, booking.timezone, { day: "numeric" })}</strong>
        <small>{formatDate(booking.starts_at, booking.timezone, { month: "short" })}</small>
      </div>
      <div className="booking-item-details">
        <strong>{booking.name}</strong>
        <span>{formatTime(booking.starts_at, booking.timezone)}</span>
        <small>
          {booking.host_organization_name} · {booking.venue_name}
          {booking.location_updated ? " · Location updated" : ""}
        </small>
      </div>
      <div className="booking-item-actions">
        <CancelBookingDialog booking={booking} label="Cancel" />
        <Link
          className="booking-item-chevron"
          href={`/manage-bookings/${booking.registration_id}`}
          aria-label={`View booking details for ${booking.name}`}
        >
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </article>
  );
}

function ReturningBookingList({ bookings }: { bookings: ManagedBooking[] }) {
  return (
    <div className="booking-list" aria-label="My bookings">
      {bookings.map((booking) => (
        <ReturningBookingCard key={booking.registration_id} booking={booking} />
      ))}
    </div>
  );
}

function ReturningLandingPage({
  firstName,
  bookings,
}: {
  firstName: string;
  bookings: ManagedBooking[];
}) {
  const { upNext, remainingActive } = splitManagedBookings(bookings);
  const activeBookingCount = (upNext ? 1 : 0) + remainingActive.length;

  return (
    <div className="home-page home-returning-page">
      <HomeNavigation />
      <main>
        <section className="returning-hero" aria-labelledby="returning-title">
          <div>
            <p className="home-kicker">Your home</p>
            <h1 id="returning-title">
              Welcome back,
              <br />
              <em>{firstName}.</em>
            </h1>
            <p className="returning-lede">
              {activeBookingCount
                ? "Your next session is ready when you are."
                : "Choose another class to keep your rhythm moving."}
            </p>
          </div>
          <div className="returning-badge">
            <ScrollTurningLine />
            <strong>
              {activeBookingCount} {activeBookingCount === 1 ? "session" : "sessions"} ready
            </strong>
          </div>
        </section>

        <section className="returning-up-next" aria-labelledby="returning-up-next">
          {upNext ? (
            <>
              <div>
                <p className="home-kicker">Up next</p>
                <h2 id="returning-up-next">{upNext.name}</h2>
                <div className="up-next-details">
                  <div className="booking-date-treatment" aria-label="Event date">
                    <b>{formatDate(upNext.starts_at, upNext.timezone, { weekday: "short" })}</b>
                    <strong>
                      {formatDate(upNext.starts_at, upNext.timezone, { day: "numeric" })}
                    </strong>
                    <small>
                      {formatDate(upNext.starts_at, upNext.timezone, { month: "short" })}
                    </small>
                  </div>
                  <p>
                    {formatTime(upNext.starts_at, upNext.timezone)}
                    <br />
                    {upNext.venue_name}
                    <br />
                    {upNext.venue_street}, {upNext.venue_city}, {upNext.venue_state}
                  </p>
                </div>
                <span className="booking-confirmed">Confirmed booking</span>
              </div>
              <div className="up-next-actions">
                <Link className="home-primary" href={`/manage-bookings/${upNext.registration_id}`}>
                  View booking <span aria-hidden="true">↗</span>
                </Link>
                <CancelBookingDialog
                  booking={upNext}
                  label="Cancel booking"
                  className="returning-cancel-button"
                />
              </div>
            </>
          ) : (
            <div className="returning-empty">
              <p className="home-kicker">Up next</p>
              <h2 id="returning-up-next">Your schedule is open.</h2>
              <p>Choose another class to keep your rhythm moving.</p>
              <Link className="home-primary" href="/events">
                Browse Events <span aria-hidden="true">↗</span>
              </Link>
            </div>
          )}
        </section>

        {remainingActive.length ? (
          <section className="returning-lower" aria-labelledby="returning-bookings">
            <div className="returning-bookings">
              <div className="home-section-head">
                <p className="home-kicker">My bookings</p>
                <Link className="home-text-link" href="/manage-bookings">
                  Manage all <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <ReturningBookingList bookings={remainingActive} />
            </div>
            <div className="returning-discover">
              <p className="home-kicker">Discover</p>
              <h2>
                Keep the
                <br />
                <em>rhythm.</em>
              </h2>
              <p>There is always another class, table, or practice to step into.</p>
              <Link className="home-text-link" href="/events">
                Browse Events <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </section>
        ) : (
          <section
            className="returning-lower returning-lower-empty"
            aria-labelledby="returning-discover-title"
          >
            <div className="returning-bookings" />
            <div className="returning-discover">
              <p className="home-kicker">Discover</p>
              <h2 id="returning-discover-title">
                Keep the
                <br />
                <em>rhythm.</em>
              </h2>
              <p>There is always another class, table, or practice to step into.</p>
              <Link className="home-text-link" href="/events">
                Browse Events <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </section>
        )}
      </main>
      <footer className="home-footer">
        <span>Arakkis / Home</span>
        <span className="home-footer-accent">Make room for what matters.</span>
      </footer>
    </div>
  );
}

export default async function HomePage() {
  const rememberedParticipant = await resolveRememberedParticipant();
  if (!rememberedParticipant) return <PublicLandingPage />;

  const managed = await getManagedBookings();
  if (!managed || managed.participant_id !== rememberedParticipant.participant_id) {
    return <PublicLandingPage />;
  }

  return (
    <ReturningLandingPage
      firstName={rememberedParticipant.first_name}
      bookings={managed.bookings}
    />
  );
}
