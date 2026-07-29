import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { createClient } from "@/lib/db/server";

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
    <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <SectionHeader
          eyebrow="Find your next session"
          title="Upcoming events"
          description="A few good hours, thoughtfully planned. Choose a date, reserve your spot, and we’ll take care of the rest."
        />
        <Badge className="w-fit bg-coral/10 text-coral">
          {events.length} {events.length === 1 ? "event" : "events"}
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
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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
                <Card className="group flex h-full flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-soft">
                  <div className="h-2 bg-brand" />
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold uppercase tracking-[0.12em] text-coral">
                        {date} · {time}
                      </p>
                      <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                        {spots} spots
                      </span>
                    </div>
                    <h2 className="mt-5 text-2xl font-semibold tracking-tight">{event.name}</h2>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                      {event.description ??
                        "A welcoming session for building strength, energy, and community."}
                    </p>
                    <div className="mt-6 space-y-2 border-t border-slate-100 pt-5 text-sm text-slate-500">
                      <p>
                        ⌖ {event.venue_name} · {event.venue_city}, {event.venue_state}
                      </p>
                      <p>Hosted by {event.host_organization_name}</p>
                    </div>
                    <Link
                      className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-5 font-semibold text-white transition group-hover:bg-brand-dark"
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
    </section>
  );
}
