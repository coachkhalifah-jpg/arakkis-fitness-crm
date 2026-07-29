import Link from "next/link";
import { requireOrganizationAccess } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { archiveVenue, updateVenueForm } from "@/lib/services/phase-3-actions";

export default async function VenueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const { data: venue } = await db.from("venues").select("*").eq("id", id).single();
  if (!venue) return <p className="mx-auto max-w-5xl px-6 py-12">Venue not found.</p>;
  const admin = await requireOrganizationAccess(venue.organization_id ?? "", `/admin/venues/${id}`);
  const { data: organizations } = await db
    .from("organizations")
    .select("id,name")
    .eq("active_status", "ACTIVE")
    .order("name");
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <Link className="text-sm text-brand" href="/admin/venues">
        ← Venues
      </Link>
      <h1 className="mt-3 text-3xl font-semibold text-ink">{venue.name}</h1>
      <p className="mt-2 text-slate-600">
        {venue.timezone} · {venue.active_status}
      </p>
      {admin.role === "SYSTEM_ADMIN" ? (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Edit venue</h2>
          <form action={updateVenueForm} className="grid gap-4">
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
            <Button type="submit">Save venue</Button>
          </form>
          {venue.active_status !== "ARCHIVED" ? (
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
    </section>
  );
}
