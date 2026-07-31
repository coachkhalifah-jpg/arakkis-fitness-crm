import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/db/server";
import { publicBrand } from "@/lib/config/branding";
import type { CSSProperties } from "react";

type PublicEvent = {
  id: string;
  name: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  venue_name: string;
  venue_city: string;
  venue_state: string;
  host_organization_name: string;
  capacity: number;
  active_registration_count: number;
  visibility: string;
  public_slug: string | null;
};

export default async function EventsPage() {
  const db = await createClient();
  const { data } = await db.from("public_event_schedule").select("*").order("starts_at");
  const events = (data ?? []) as PublicEvent[];
  return (
    <section
      className="event-hub-shell min-h-[calc(100vh-4rem)] px-5 py-12 sm:px-8 sm:py-16"
      style={
        {
          "--hub-desktop": `url(${publicBrand.desktopBackgroundPath})`,
          "--hub-mobile": `url(${publicBrand.mobileBackgroundPath})`,
          "--hub-fallback": publicBrand.fallbackBackground,
          "--hub-overlay": publicBrand.overlayStrength,
          "--hub-desktop-position": publicBrand.desktopFocalPosition,
          "--hub-mobile-position": publicBrand.mobileFocalPosition,
        } as CSSProperties
      }
    >
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <Image
          className="h-20 w-20 rounded-[1.6rem] border border-white/80 bg-white/80 p-1 shadow-soft"
          src={publicBrand.logoPath}
          alt={`${publicBrand.organizationName} logo`}
          width={80}
          height={80}
        />
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-brand-dark">
          {publicBrand.organizationName}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">
          Move with your people.
        </h1>
        <p className="mt-3 max-w-md text-base leading-7 text-slate-700">{publicBrand.tagline}</p>
        <nav
          className="mt-5 flex items-center justify-center gap-2"
          aria-label="Social and contact links"
        >
          {publicBrand.links.map((link) => (
            <a
              key={link.href}
              className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-white/80 bg-white/75 px-3 text-sm font-semibold text-ink shadow-sm transition duration-150 hover:-translate-y-0.5 hover:bg-white active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand/40"
              href={link.href}
              aria-label={link.label}
            >
              <span aria-hidden="true" className="mr-1.5 text-base">
                {link.icon}
              </span>
              <span className="sr-only sm:not-sr-only">{link.label}</span>
            </a>
          ))}
        </nav>
        <Badge className="mt-6 border border-white/80 bg-white/70 text-brand-dark">
          {events.length} {events.length === 1 ? "upcoming session" : "upcoming sessions"}
        </Badge>
      </div>
      {events.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="The next session is still taking shape"
            description="There are no public events available right now. Check back soon for the next welcoming workout."
            href="/"
            action="Back to home"
          />
        </div>
      ) : (
        <div className="mx-auto mt-10 max-w-xl space-y-5">
          {events.map((event) => {
            const spots = Math.max(0, event.capacity - event.active_registration_count);
            const date = new Intl.DateTimeFormat("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              timeZone: event.timezone,
            }).format(new Date(event.starts_at));
            const time = new Intl.DateTimeFormat("en-US", {
              hour: "numeric",
              minute: "2-digit",
              timeZone: event.timezone,
            }).format(new Date(event.starts_at));
            return (
              <article key={event.id}>
                <Card className="group overflow-hidden rounded-[1.6rem] border-white/80 bg-white/90 p-1 shadow-soft backdrop-blur-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="rounded-[1.35rem] p-5 sm:p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-coral">
                      {date} · {time}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-tight">
                      {event.name}
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
                      <span>{event.venue_name}</span>
                      <span>
                        {event.venue_city}, {event.venue_state}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-brand-dark">
                      {spots > 0
                        ? `${spots} spots available · Open for registration`
                        : "Full · Registration closed"}
                    </p>
                    <Link
                      className="mt-5 inline-flex min-h-14 w-full items-center justify-between rounded-2xl bg-brand px-5 text-left font-semibold text-white transition duration-150 hover:bg-brand-dark active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand/40"
                      href={event.public_slug ? `/register/${event.public_slug}` : "/registration"}
                    >
                      <span>View session details</span>
                      <span aria-hidden="true" className="text-xl">
                        →
                      </span>
                    </Link>
                  </div>
                </Card>
              </article>
            );
          })}
        </div>
      )}
      <footer className="mx-auto mt-10 flex max-w-xl justify-center gap-4 text-sm text-slate-500">
        {publicBrand.links.map((link) => (
          <Link key={link.href} className="underline-offset-4 hover:underline" href={link.href}>
            {link.label}
          </Link>
        ))}
      </footer>
    </section>
  );
}
