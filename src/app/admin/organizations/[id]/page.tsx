import Link from "next/link";
import { requireOrganizationAccess } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { archiveOrganization, updateOrganization } from "@/lib/services/phase-3-actions";
import { ContextualBack } from "@/components/admin/contextual-back";

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireOrganizationAccess(id, `/admin/organizations/${id}`);
  const db = await createClient();
  const [{ data: organization }, { data: venues }, { data: events }] = await Promise.all([
    db.from("organizations").select("*").eq("id", id).single(),
    db
      .from("venues")
      .select("id,name,active_status,timezone")
      .eq("organization_id", id)
      .order("name"),
    db
      .from("events")
      .select("id,name,status,starts_at,timezone")
      .eq("host_organization_id", id)
      .order("starts_at", { ascending: false }),
  ]);
  if (!organization) return <p className="mx-auto max-w-5xl px-6 py-12">Organization not found.</p>;
  return (
    <section className="admin-shell px-5 py-10 sm:px-8 sm:py-14">
      <div className="relative mx-auto max-w-3xl pt-8">
        <ContextualBack href="/admin/organizations" label="Organizations" />
        <div className="admin-page-header">
          <h1>{organization.name}</h1>
          <p>{organization.active_status}</p>
        </div>
        {admin.role === "SYSTEM_ADMIN" ? (
          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Edit organization</h2>
            <ActionForm action={updateOrganization} submitLabel="Save organization">
              <input type="hidden" name="id" value={id} />
              <label>
                Name
                <input
                  name="name"
                  required
                  defaultValue={organization.name}
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <label>
                Type
                <input
                  name="organizationType"
                  defaultValue={organization.organization_type ?? ""}
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <label>
                Street
                <input
                  name="street"
                  defaultValue={organization.street ?? ""}
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <label>
                City
                <input
                  name="city"
                  defaultValue={organization.city ?? ""}
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <label>
                State
                <input
                  name="state"
                  defaultValue={organization.state ?? ""}
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <label>
                Postal code
                <input
                  name="postalCode"
                  defaultValue={organization.postal_code ?? ""}
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
            </ActionForm>
            {organization.active_status !== "ARCHIVED" ? (
              <form
                action={async () => {
                  "use server";
                  await archiveOrganization(id);
                }}
                className="mt-4"
              >
                <ConfirmSubmit message="Archive this organization? Historical relationships will be preserved.">
                  Archive organization
                </ConfirmSubmit>
              </form>
            ) : null}
          </div>
        ) : null}
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Venues</h2>
            <ul className="mt-4 space-y-2">
              {(venues ?? []).map((venue) => (
                <li key={venue.id}>
                  <Link className="text-brand" href={`/admin/venues/${venue.id}`}>
                    {venue.name}
                  </Link>
                  <span className="ml-2 text-sm text-slate-500">
                    {venue.timezone} · {venue.active_status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Events</h2>
            <ul className="mt-4 space-y-2">
              {(events ?? []).map((event) => (
                <li key={event.id}>
                  <Link className="text-brand" href={`/admin/events/${event.id}`}>
                    {event.name}
                  </Link>
                  <span className="ml-2 text-sm text-slate-500">{event.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
