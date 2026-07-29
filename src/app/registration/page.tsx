import { Card } from "@/components/ui/card";
import { RegistrationForm } from "@/components/registration/registration-form";
import { createClient } from "@/lib/db/server";
import { isProductionRegistrationBlocked } from "@/lib/config/env";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function RegistrationPage() {
  const db = await createClient();
  const [{ data: events }, { data: config }] = await Promise.all([
    db.from("public_event_schedule").select("*").order("starts_at"),
    db.rpc("get_public_registration_config"),
  ]);
  const registrationConfig = (config ?? {}) as {
    participation: { id: string; text: string } | null;
    data_use: { id: string; text: string } | null;
    organizations: Array<{ id: string; name: string }>;
  };
  return (
    <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="mb-9">
        <SectionHeader
          eyebrow="Public registration"
          title="Reserve your spot"
          description="Choose upcoming dates, complete one short form, and receive a private confirmation link. No participant account is required."
        />
      </div>
      {isProductionRegistrationBlocked() ? (
        <Card className="border-amber-300 bg-amber-50 p-6" role="status">
          Registration is unavailable while the Participation acknowledgment remains provisional. No
          participant information can be submitted.
        </Card>
      ) : events && events.length > 0 ? (
        <RegistrationForm
          events={events as never}
          organizations={registrationConfig.organizations ?? []}
          participation={registrationConfig.participation}
          dataUse={registrationConfig.data_use}
          idempotencyKey={crypto.randomUUID()}
        />
      ) : (
        <EmptyState
          title="No upcoming dates just yet"
          description="We’re preparing the next sessions. Come back soon or explore the event hub for the latest availability."
          href="/events"
          action="Explore events"
        />
      )}
    </section>
  );
}
