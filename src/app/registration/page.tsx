import { Card } from "@/components/ui/card";
import { RegistrationForm } from "@/components/registration/registration-form";
import { createClient } from "@/lib/db/server";
import { isProductionRegistrationBlocked } from "@/lib/config/env";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { legalDocuments } from "@/lib/legal/documents";
import type { LegalPackage } from "@/lib/legal/package";

export default async function RegistrationPage() {
  const db = await createClient();
  const [{ data: events }, { data: config }] = await Promise.all([
    db.from("public_event_schedule").select("*").order("starts_at"),
    db.rpc("get_public_registration_config"),
  ]);
  const registrationConfig = (config ?? {}) as {
    legal_documents: unknown[];
    legal_package: LegalPackage | null;
    organizations: Array<{ id: string; name: string }>;
  };
  return (
    <section className="booking-environment registration-northstar mx-auto min-h-screen w-full max-w-[520px] px-4 py-10 sm:px-5 sm:py-12">
      <div className="mb-9">
        <SectionHeader
          eyebrow="Public registration"
          title="Reserve your spot"
          description="Choose upcoming dates, complete one short form, and receive a private confirmation link. No participant account is required."
        />
      </div>
      {isProductionRegistrationBlocked() ? (
        <Card className="border-amber-300 bg-amber-50 p-6" role="status">
          Registration is unavailable while required pilot legal readiness is pending. No
          participant information can be submitted.
        </Card>
      ) : events && events.length > 0 ? (
        <RegistrationForm
          events={events as never}
          legalPackage={registrationConfig.legal_package}
          idempotencyKey={crypto.randomUUID()}
          legalDocuments={legalDocuments}
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
