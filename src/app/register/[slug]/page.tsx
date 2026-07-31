import { Card } from "@/components/ui/card";
import { RegistrationForm } from "@/components/registration/registration-form";
import { createClient } from "@/lib/db/server";
import { isProductionRegistrationBlocked } from "@/lib/config/env";
import { resolveRememberedParticipant } from "@/lib/registration/device";

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
  const availability = legallyBlocked ? "LEGALLY_BLOCKED" : event.availability;
  const recurringEvents = event.series_slug ? event.occurrences : [];
  const registrationEvents = recurringEvents.length ? recurringEvents : [event];
  const available =
    !legallyBlocked &&
    (event.series_slug
      ? recurringEvents.some(
          (occurrence) => occurrence.active_registration_count < occurrence.capacity,
        )
      : availability === "OPEN");
  return (
    <section className="booking-environment min-h-[calc(100vh-4rem)] px-5 py-8 transition-colors duration-500 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Card className="border-brand/20 bg-white p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
            Class environment
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-ink">{event.name}</h1>
          <p className="mt-3 text-slate-600">
            Hosted by {event.host_organization_name} · {event.venue_name}
          </p>
          <p className="mt-1 text-slate-600">
            {event.venue_street}, {event.venue_city}, {event.venue_state}
          </p>
          <p className="mt-5 text-slate-700">
            {new Intl.DateTimeFormat("en-US", {
              dateStyle: "full",
              timeStyle: "short",
              timeZone: event.timezone,
            }).format(new Date(event.starts_at))}
          </p>
          {event.description ? (
            <p className="mt-5 whitespace-pre-wrap text-slate-600">{event.description}</p>
          ) : null}
          {event.participant_instructions ? (
            <p className="mt-5 whitespace-pre-wrap text-slate-600">
              {event.participant_instructions}
            </p>
          ) : null}
          <p className="mt-6 rounded-2xl bg-ink p-4 font-medium text-white">
            Registration: {availability.replaceAll("_", " ")}
          </p>
          {available ? (
            <div className="mt-6">
              <p className="mb-4 text-sm text-slate-600">
                {event.capacity - event.active_registration_count} spots available
              </p>
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
          ) : null}
        </Card>
      </div>
    </section>
  );
}
