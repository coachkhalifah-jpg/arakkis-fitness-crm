import { RegistrationForm } from "@/components/registration/registration-form";
import { EventHero } from "@/components/registration/event-hero";
import { createClient } from "@/lib/db/server";
import { isProductionRegistrationBlocked } from "@/lib/config/env";
import { resolveRememberedParticipant } from "@/lib/registration/device";
import { designAssetPublicUrl } from "@/lib/config/design-assets";
import { legalDocuments } from "@/lib/legal/documents";
import type { LegalPackage } from "@/lib/legal/package";
import { PublicErrorState } from "@/components/registration/public-error-state";

export default async function PublicEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const { slug } = await params;
  const { invite } = await searchParams;
  const db = await createClient();
  const [{ data }, { data: config }] = await Promise.all([
    db.rpc("get_public_event_by_slug_access", { p_slug: slug, p_invite_token: invite ?? null }),
    db.rpc("get_public_registration_config"),
  ]);
  const registrationConfig = (config ?? {}) as {
    legal_documents: unknown[];
    legal_package: LegalPackage | null;
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
    venue_postal_code: string;
    availability: string;
    capacity: number;
    active_registration_count: number;
    series_slug: string | null;
    occurrences: Array<{
      id: string;
      name: string;
      starts_at: string;
      ends_at: string;
      timezone: string;
      capacity: number;
      active_registration_count: number;
      availability: string;
      venue_name: string;
      venue_street: string;
      venue_city: string;
      venue_state: string;
      venue_postal_code: string;
      host_organization_name: string;
    }>;
  } | null;
  if (!event)
    return (
      <PublicErrorState
        code="404"
        title="This event could not be found."
        message="The event may be unpublished, closed, cancelled, or no longer available."
        actionLabel="Browse events"
        actionHref="/events"
      />
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
  const available =
    !legallyBlocked &&
    (event.series_slug
      ? recurringEvents.some(
          (occurrence) =>
            ![
              "FULL",
              "CLOSED",
              "CANCELLED",
              "PAUSED",
              "NOT_YET_OPEN",
              "UNPUBLISHED",
              "LEGALLY_BLOCKED",
            ].includes(occurrence.availability),
        )
      : availability === "OPEN");
  if (!available)
    return (
      <PublicErrorState
        code="CLOSED"
        title="Registration is unavailable."
        message="This event is not currently accepting registrations."
        actionLabel="Browse events"
        actionHref="/events"
      />
    );
  return (
    <section className="booking-environment registration-northstar mx-auto min-h-screen w-full max-w-[520px] pb-16 transition-colors duration-500">
      <EventHero
        eventName={event.name}
        host={event.host_organization_name}
        venue={event.venue_name}
        imageUrl={desktopAsset ? designAssetPublicUrl(desktopAsset.storage_path) : undefined}
        mobileImageUrl={mobileAsset ? designAssetPublicUrl(mobileAsset.storage_path) : undefined}
        focalPosition={desktopAsset?.focal_position ?? mobileAsset?.focal_position ?? "center"}
      />
      <div className="public-registration-content px-4 pt-8 sm:px-5 sm:pt-10">
        <div className="mt-8">
          <RegistrationForm
            events={registrationEvents.map((occurrence) => ({
              name: occurrence.name,
              starts_at: occurrence.starts_at,
              ends_at: occurrence.ends_at,
              timezone: occurrence.timezone,
              venue_name: occurrence.venue_name ?? event.venue_name,
              venue_street: occurrence.venue_street ?? event.venue_street,
              venue_city: occurrence.venue_city ?? event.venue_city,
              venue_state: occurrence.venue_state ?? event.venue_state,
              venue_postal_code: occurrence.venue_postal_code ?? event.venue_postal_code,
              host_organization_name:
                occurrence.host_organization_name ?? event.host_organization_name,
              active_registration_count: occurrence.active_registration_count,
              capacity: occurrence.capacity,
              availability: occurrence.availability,
              visibility: "PUBLIC",
            }))}
            legalPackage={registrationConfig.legal_package}
            idempotencyKey={crypto.randomUUID()}
            publicSlug={slug}
            seriesMode={Boolean(event.series_slug)}
            rememberedFirstName={remembered?.first_name ?? null}
            rememberedGoals={remembered?.goals ?? null}
            legalDocuments={legalDocuments}
            eventInviteToken={invite ?? null}
          />
        </div>
      </div>
    </section>
  );
}
