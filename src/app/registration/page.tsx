import { Card } from "@/components/ui/card";
import { RegistrationForm } from "@/components/registration/registration-form";
import { createClient } from "@/lib/db/server";
import { isProductionRegistrationBlocked } from "@/lib/config/env";

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
    <section className="mx-auto max-w-5xl px-6 py-12">
      <Card className="mb-8 border-brand/20 bg-white p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
          Public registration
        </p>
        <h1 className="mt-2 text-4xl font-semibold text-ink">Reserve your spot</h1>
        <p className="mt-4 max-w-2xl text-slate-600">
          Choose upcoming dates, complete one short form, and receive a private confirmation link.
          No participant account is required.
        </p>
      </Card>
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
        <Card className="p-6">There are no eligible upcoming registration dates right now.</Card>
      )}
    </section>
  );
}
