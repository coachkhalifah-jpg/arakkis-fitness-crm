import Link from "next/link";
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
        } as CSSProperties
      }
    >
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <img className="h-16 w-16 rounded-2xl shadow-soft" src={publicBrand.logoPath} alt="" />
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-brand-dark">
          {publicBrand.organizationName}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          Find your next good hour.
        </h1>
        <p className="mt-3 max-w-md text-base leading-7 text-slate-600">{publicBrand.tagline}</p>
        <Badge className="mt-5 bg-coral/10 text-coral">
          {events.length} {events.length === 1 ? "upcoming event" : "upcoming events"}
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
        <div className="mx-auto mt-10 max-w-xl space-y-4">
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
                <Card className="group overflow-hidden border-white/70 bg-white/90 p-1 shadow-soft backdrop-blur-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="rounded-[0.9rem] p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-[0.12em] text-coral">
                          {date} · {time}
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{event.name}</h2>
                      </div>
                      <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                        {spots} spots
                      </span>
                    </div>
                    <div className="mt-5 space-y-1 text-sm text-slate-600">
                      <p>
                        {event.venue_name} · {event.venue_city}, {event.venue_state}
                      </p>
                      <p>{spots > 0 ? "Open for registration" : "Full"}</p>
                    </div>
                    <Link
                      className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 font-semibold text-white transition duration-150 hover:scale-[0.99] hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand/40"
                      href={event.public_slug ? `/register/${event.public_slug}` : "/registration"}
                    >
                      Reserve My Spot <span className="ml-2">→</span>
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
