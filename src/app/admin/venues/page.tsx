import { requireActiveAdmin } from "@/lib/authorization/server";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { archiveVenueForm, createVenueForm } from "@/lib/services/phase-3-actions";
import { Button } from "@/components/ui/button";

export default async function VenuesPage() {
  const admin = await requireActiveAdmin();
  const db = await createClient();
  const { data: organizations } = await db
    .from("organizations")
    .select("id,name")
    .eq("active_status", "ACTIVE")
    .order("name");
  const { data: venues } = await db
    .from("venues")
    .select("id,name,timezone,active_status,organization_id")
    .order("name");
  const visibleVenues =
    admin.role === "SYSTEM_ADMIN"
      ? venues
      : (venues ?? []).filter((venue) =>
          admin.organizationIds.includes(venue.organization_id ?? ""),
        );
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-ink">Venues</h1>
      <p className="mt-2 text-slate-600">
        Venue-local scheduling uses the server-validated IANA timezone.
      </p>
      {admin.role === "SYSTEM_ADMIN" ? (
        <form
          action={createVenueForm}
          className="mt-8 grid gap-3 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2"
        >
          <h2 className="sm:col-span-2 text-lg font-semibold">Create venue</h2>
          <label>
            Name
            <input name="name" required className="mt-1 w-full rounded border p-2" />
          </label>
          <label>
            Organization
            <select name="organizationId" required className="mt-1 w-full rounded border p-2">
              <option value="">Select organization</option>
              {(organizations ?? []).map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Street
            <input name="street" required className="mt-1 w-full rounded border p-2" />
          </label>
          <label>
            City
            <input name="city" required className="mt-1 w-full rounded border p-2" />
          </label>
          <label>
            State
            <input name="state" required className="mt-1 w-full rounded border p-2" />
          </label>
          <label>
            Postal code
            <input name="postalCode" required className="mt-1 w-full rounded border p-2" />
          </label>
          <label className="sm:col-span-2">
            IANA timezone
            <input
              name="timezone"
              defaultValue="America/New_York"
              required
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <Button type="submit">Create venue</Button>
        </form>
      ) : null}
      <div className="mt-8 space-y-3">
        {(visibleVenues ?? []).map((venue) => (
          <article
            key={venue.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4"
          >
            <div>
              <h2 className="font-medium">
                <Link className="text-brand" href={`/admin/venues/${venue.id}`}>
                  {venue.name}
                </Link>
              </h2>
              <p className="text-sm text-slate-500">
                {venue.organization_id} · {venue.timezone} · {venue.active_status}
              </p>
            </div>
            {admin.role === "SYSTEM_ADMIN" && venue.active_status !== "ARCHIVED" ? (
              <form action={archiveVenueForm.bind(null, venue.id)}>
                <Button type="submit">Archive</Button>
              </form>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
