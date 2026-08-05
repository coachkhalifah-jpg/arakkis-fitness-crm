import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveAdmin, requireOrganizationAccess } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { ActionForm } from "@/components/admin/action-form";
import { archiveVenue, updateVenueState } from "@/lib/services/phase-3-actions";
import { ContextualBack } from "@/components/admin/contextual-back";

export default async function VenueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const { data: venue } = await db.from("venues").select("*").eq("id", id).single();
  if (!venue) {
    const admin = await requireActiveAdmin(`/admin/venues/${id}`);
    if (admin.role === "HOST_ADMIN") {
      redirect("/admin/access-denied");
    }
    return <p className="mx-auto max-w-5xl px-6 py-12">Venue not found.</p>;
  }
  const admin = await requireOrganizationAccess(venue.organization_id ?? "", `/admin/venues/${id}`);
  const { data: organizations } = await db
    .from("organizations")
    .select("id,name")
    .eq("active_status", "ACTIVE")
    .order("name");
  return (
    <section className="admin-shell px-5 py-10 sm:px-8 sm:py-14">
      <div className="relative mx-auto max-w-3xl pt-8">
        <ContextualBack href="/admin/venues" label="Venues" />
        <div className="admin-page-header">
          <h1>{venue.name}</h1>
          <p>
            {venue.timezone} · {venue.active_status}
          </p>
        </div>
        {admin.role === "SYSTEM_ADMIN" ||
        admin.organizationIds.includes(venue.organization_id ?? "") ? (
          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Edit venue</h2>
            <ActionForm action={updateVenueState} submitLabel="Save venue">
              <input type="hidden" name="id" value={id} />
              <label>
                Name
                <input
                  name="name"
                  required
                  defaultValue={venue.name}
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              {admin.role === "SYSTEM_ADMIN" ? (
                <label>
                  Organization
                  <select
                    name="organizationId"
                    defaultValue={venue.organization_id ?? ""}
                    className="mt-1 w-full rounded border p-2"
                  >
                    {(organizations ?? []).map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <input type="hidden" name="organizationId" value={venue.organization_id ?? ""} />
              )}
              <label>
                Street
                <input
                  name="street"
                  required
                  defaultValue={venue.street}
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <label>
                City
                <input
                  name="city"
                  required
                  defaultValue={venue.city}
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <label>
                State
                <input
                  name="state"
                  required
                  defaultValue={venue.state}
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <label>
                Postal code
                <input
                  name="postalCode"
                  required
                  defaultValue={venue.postal_code}
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <label>
                IANA timezone
                <input
                  name="timezone"
                  required
                  defaultValue={venue.timezone}
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
            </ActionForm>
            {admin.role === "SYSTEM_ADMIN" && venue.active_status !== "ARCHIVED" ? (
              <form
                action={async () => {
                  "use server";
                  await archiveVenue(id);
                }}
                className="mt-4"
              >
                <ConfirmSubmit message="Archive this venue? Existing event timestamps will be preserved.">
                  Archive venue
                </ConfirmSubmit>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
