import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ParticipantEventsView,
  type ParticipantEventCard,
} from "@/components/events/participant-events-view";
import { createClient } from "@/lib/db/server";
import { publicBrand } from "@/lib/config/branding";
import { eventCardAsset } from "@/lib/config/admin-visual-assets";
import { designAssetPublicUrl } from "@/lib/config/design-assets";
import { participantDisplayName } from "@/lib/registration/display";
import { resolveRememberedParticipant } from "@/lib/registration/device";
import type { CSSProperties } from "react";

type PublicEvent = {
  id: string;
  name: string;
  event_title_color: string;
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
  const [{ data }, { data: backgroundAssets }, remembered] = await Promise.all([
    db.from("public_event_schedule").select("*").order("starts_at"),
    db
      .from("design_assets")
      .select("asset_type,storage_path,focal_position")
      .eq("active", true)
      .in("asset_type", ["PUBLIC_BACKGROUND_DESKTOP", "PUBLIC_BACKGROUND_MOBILE"]),
    resolveRememberedParticipant(),
  ]);
  const events = (data ?? []) as PublicEvent[];
  const { data: eventImageAssets } = events.length
    ? await db
        .from("design_assets")
        .select("event_id,storage_path,focal_position")
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
  const eventImageFocalById = new Map(
    (eventImageAssets ?? []).map((asset) => [asset.event_id, asset.focal_position ?? "center"]),
  );
  const desktopBackground = backgroundAssets?.find(
    (asset) => asset.asset_type === "PUBLIC_BACKGROUND_DESKTOP",
  );
  const mobileBackground = backgroundAssets?.find(
    (asset) => asset.asset_type === "PUBLIC_BACKGROUND_MOBILE",
  );
  const mappedEvents: ParticipantEventCard[] = events.map((event) => {
    const spots = Math.max(0, event.capacity - event.active_registration_count);
    const dateParts = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: event.timezone,
    }).formatToParts(new Date(event.starts_at));
    const time = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: event.timezone,
    }).format(new Date(event.starts_at));
    return {
      id: event.id,
      name: participantDisplayName(event.name),
      description: event.description,
      organizationName: participantDisplayName(event.host_organization_name),
      venueName: participantDisplayName(event.venue_name),
      time,
      date: {
        weekday: dateParts.find((part) => part.type === "weekday")?.value ?? "",
        day: dateParts.find((part) => part.type === "day")?.value ?? "",
        month: dateParts.find((part) => part.type === "month")?.value ?? "",
      },
      spots,
      href: event.public_slug ? `/register/${event.public_slug}` : "/registration",
      availability: spots > 0 ? "OPEN" : "FULL",
      imageUrl: eventImageById.get(event.id) ?? eventCardAsset(event.name),
      focalPosition: eventImageFocalById.get(event.id) ?? "center",
      titleColor: event.event_title_color,
    };
  });
  // Server-rendered grouping intentionally uses the current instant.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const weekEnd = now + 7 * 24 * 60 * 60 * 1000;
  const thisWeek = mappedEvents.filter((event) => {
    const source = events.find((item) => item.id === event.id);
    if (!source) return false;
    const startsAt = Date.parse(source.starts_at);
    return startsAt >= now && startsAt <= weekEnd;
  });
  const organizationMap = new Map<string, ParticipantEventCard[]>();
  for (const event of mappedEvents) {
    const key = event.organizationName ?? "Upcoming Events";
    organizationMap.set(key, [...(organizationMap.get(key) ?? []), event]);
  }
  const upcomingByOrganization = [...organizationMap.entries()].map(
    ([name, organizationEvents]) => ({
      name,
      description: "Events and recurring practices available here.",
      events: organizationEvents,
    }),
  );
  return (
    <section
      className="event-hub-shell participant-events-page min-h-[calc(100vh-4rem)] px-5 py-12 sm:px-8 sm:py-16"
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
      <div className="participant-events-shell">
        {remembered ? (
          <div className="participant-events-returning">
            <span>Welcome back, {remembered.first_name}</span>
          </div>
        ) : null}
        <section className="participant-events-heading" aria-labelledby="participant-events-title">
          <div>
            <p className="participant-events-eyebrow">02 / Events</p>
            <h1 id="participant-events-title">
              Find your
              <br />
              <em>rhythm.</em>
            </h1>
          </div>
          <p className="participant-events-intro">
            {publicBrand.tagline} Start with the people and places you are connected to, then
            explore other public events that may fit your practice.
          </p>
        </section>
        {remembered ? (
          <Link className="participant-events-manage-link" href="/manage-bookings">
            Manage bookings <span aria-hidden="true">↗</span>
          </Link>
        ) : null}
        {events.length === 0 ? (
          <div className="participant-events-empty">
            <EmptyState
              description="There are no public events available right now. Check back soon for the next welcoming workout."
              href="/"
              action="Return home"
              variant="public-events"
            />
          </div>
        ) : (
          <ParticipantEventsView
            thisWeek={thisWeek}
            upcomingByOrganization={upcomingByOrganization}
          />
        )}
      </div>
    </section>
  );
}
