import { RegistrationForm } from "@/components/registration/registration-form";
import { EventHero } from "@/components/registration/event-hero";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/db/server";
import { isProductionRegistrationBlocked } from "@/lib/config/env";
import { resolveRememberedParticipant } from "@/lib/registration/device";
import { designAssetPublicUrl } from "@/lib/config/design-assets";

export default async function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await createClient();
  const [{ data }, { data: config }] = await Promise.all([
    db.rpc("get_public_event_by_slug", { p_slug: slug }),
    db.rpc("get_public_registration_config"),
  ]);
  const registrationConfig = (config ?? {}) as {
    participation: { id: string; text: string } | null;
    data_use: { id: string; text: string } | null;
    organizations: Array<{ id: string; name: string }>;
  };
  const event = data as {
    id: string;
    name: string;
    description: string | null;
    participant_instructions: string | null;
    starts_at: string;
    ends_at: string;
    timezone: string;
    host_organization_name: string;
    venue_name: string;
    venue_street: string;
    venue_city: string;
    venue_state: string;
    availability: string;
    capacity: number;
    active_registration_count: number;
    series_slug: string | null;
    occurrences: Array<{
      name: string;
      starts_at: string;
      ends_at: string;
      timezone: string;
      capacity: number;
      active_registration_count: number;
    }>;
  } | null;
  if (!event)
    return (
      <section className="mx-auto max-w-2xl px-6 py-16">
        <Card className="p-8">This event is unavailable.</Card>
      </section>
    );
  const legallyBlocked = isProductionRegistrationBlocked();
  const remembered = await resolveRememberedParticipant();
  const { data: eventAssets } = await db
    .from("design_assets")
    .select("asset_type,storage_path,focal_position")
    .eq("event_id", event.id)
    .eq("active", true);
  const desktopAsset = eventAssets?.find((asset) => asset.asset_type === "EVENT_IMAGE_DESKTOP");
  const mobileAsset = eventAssets?.find((asset) => asset.asset_type === "EVENT_IMAGE_MOBILE");
  const availability = legallyBlocked ? "LEGALLY_BLOCKED" : event.availability;
  const recurringEvents = event.series_slug ? event.occurrences : [];
  const registrationEvents = recurringEvents.length ? recurringEvents : [event];
  const availableSessionCount = registrationEvents.filter(
    (session) => session.active_registration_count < session.capacity,
  ).length;
  const available =
    !legallyBlocked &&
    (event.series_slug
      ? recurringEvents.some(
          (occurrence) => occurrence.active_registration_count < occurrence.capacity,
        )
      : availability === "OPEN");
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: event.timezone,
  }).format(new Date(event.starts_at));
  const formattedTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: event.timezone,
  }).format(new Date(event.starts_at));
  return (
    <section className="booking-environment mx-auto min-h-screen w-full max-w-[520px] pb-16 transition-colors duration-500">
      <EventHero
        eventName={event.name}
        host={event.host_organization_name}
        venue={event.venue_name}
        date={formattedDate}
        time={formattedTime}
        availability={availability}
        availableSpots={Math.max(0, event.capacity - event.active_registration_count)}
        availableSessionCount={availableSessionCount}
        imageUrl={desktopAsset ? designAssetPublicUrl(desktopAsset.storage_path) : undefined}
        mobileImageUrl={mobileAsset ? designAssetPublicUrl(mobileAsset.storage_path) : undefined}
        focalPosition={desktopAsset?.focal_position ?? mobileAsset?.focal_position ?? "center"}
      />
      <div className="public-registration-content px-4 pt-8 sm:px-5 sm:pt-10">
        {event.venue_name ||
        event.venue_street ||
        event.description ||
        event.participant_instructions ? (
          <section className="public-class-details text-left">
            <h2 className="text-xl font-semibold tracking-tight text-ink">Class details</h2>
            {event.venue_name || event.venue_street ? (
              <div className="mt-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">
                  Location
                </h3>
                {event.venue_name ? (
                  <p className="mt-2 font-medium text-ink">{event.venue_name}</p>
                ) : null}
                {event.venue_street || event.venue_city || event.venue_state ? (
                  <p className="mt-1 text-slate-600">
                    {[event.venue_street, event.venue_city, event.venue_state]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}
            {event.description ? (
              <div className="mt-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">
                  About this class
                </h3>
                <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-600">
                  {event.description}
                </p>
              </div>
            ) : null}
            {event.participant_instructions ? (
              <div className="mt-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-dark">
                  What to bring
                </h3>
                <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-600">
                  {event.participant_instructions}
                </p>
              </div>
            ) : null}
          </section>
        ) : null}
        {available ? (
          <div className="mt-8">
            <RegistrationForm
              events={registrationEvents.map((occurrence) => ({
                name: occurrence.name,
                starts_at: occurrence.starts_at,
                ends_at: occurrence.ends_at,
                timezone: occurrence.timezone,
                venue_name: event.venue_name,
                host_organization_name: event.host_organization_name,
                active_registration_count: occurrence.active_registration_count,
                capacity: occurrence.capacity,
                visibility: "PUBLIC",
              }))}
              organizations={registrationConfig.organizations ?? []}
              participation={registrationConfig.participation}
              dataUse={registrationConfig.data_use}
              idempotencyKey={crypto.randomUUID()}
              publicSlug={slug}
              seriesMode={Boolean(event.series_slug)}
              rememberedFirstName={remembered?.first_name ?? null}
            />
          </div>
        ) : (
          <p className="mx-auto mt-8 max-w-xl rounded-2xl border border-amber-300 bg-amber-50 p-4 text-center text-amber-900">
            Registration is currently unavailable.
          </p>
        )}
      </div>
    </section>
  );
}
