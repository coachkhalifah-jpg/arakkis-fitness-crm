import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EventCarousel } from "@/components/events/event-carousel";
import { createClient } from "@/lib/db/server";
import { publicBrand } from "@/lib/config/branding";
import { designAssetPublicUrl } from "@/lib/config/design-assets";
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
  const [{ data }, { data: backgroundAssets }] = await Promise.all([
    db.from("public_event_schedule").select("*").order("starts_at"),
    db
      .from("design_assets")
      .select("asset_type,storage_path,focal_position")
      .eq("active", true)
      .in("asset_type", ["PUBLIC_BACKGROUND_DESKTOP", "PUBLIC_BACKGROUND_MOBILE"]),
  ]);
  const events = (data ?? []) as PublicEvent[];
  const { data: eventImageAssets } = events.length
    ? await db
        .from("design_assets")
        .select("event_id,storage_path")
        .eq("asset_type", "EVENT_IMAGE_DESKTOP")
        .eq("active", true)
        .in(
          "event_id",
          events.map((event) => event.id),
        )
    : { data: [] };
  const eventImageById = new Map(
    (eventImageAssets ?? []).map((asset) => [
      asset.event_id,
      designAssetPublicUrl(asset.storage_path),
    ]),
  );
  const desktopBackground = backgroundAssets?.find(
    (asset) => asset.asset_type === "PUBLIC_BACKGROUND_DESKTOP",
  );
  const mobileBackground = backgroundAssets?.find(
    (asset) => asset.asset_type === "PUBLIC_BACKGROUND_MOBILE",
  );
  return (
    <section
      className="event-hub-shell min-h-[calc(100vh-4rem)] px-5 py-12 sm:px-8 sm:py-16"
      style={
        {
          "--hub-desktop": `url(${desktopBackground ? designAssetPublicUrl(desktopBackground.storage_path) : publicBrand.desktopBackgroundPath})`,
          "--hub-mobile": `url(${mobileBackground ? designAssetPublicUrl(mobileBackground.storage_path) : desktopBackground ? designAssetPublicUrl(desktopBackground.storage_path) : publicBrand.mobileBackgroundPath})`,
          "--hub-fallback": publicBrand.fallbackBackground,
          "--hub-overlay": publicBrand.overlayStrength,
          "--hub-desktop-position":
            desktopBackground?.focal_position ?? publicBrand.desktopFocalPosition,
          "--hub-mobile-position":
            mobileBackground?.focal_position ??
            desktopBackground?.focal_position ??
            publicBrand.mobileFocalPosition,
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
        <EventCarousel
          events={events.map((event) => {
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
            return {
              id: event.id,
              name: event.name,
              date,
              time,
              venue: `${event.venue_name} · ${event.venue_city}, ${event.venue_state}`,
              spots,
              href: event.public_slug ? `/register/${event.public_slug}` : "/registration",
              availability: spots > 0 ? "OPEN" : "FULL",
              imageUrl: eventImageById.get(event.id),
            };
          })}
        />
      )}
      <footer className="mx-auto mt-10 flex max-w-xl justify-center gap-4 text-sm text-slate-500">
        {publicBrand.links.map((link) => (
          <a key={link.href} className="underline-offset-4 hover:underline" href={link.href}>
            {link.label}
          </a>
        ))}
      </footer>
    </section>
  );
}
