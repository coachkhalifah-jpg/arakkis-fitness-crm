import { requireActiveAdmin } from "@/lib/authorization/server";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { archiveVenueForm, createVenueForm } from "@/lib/services/phase-3-actions";
import { Button } from "@/components/ui/button";
import { SegmentedNavigation } from "@/components/admin/segmented-navigation";
import { ContextualBack } from "@/components/admin/contextual-back";

export default async function VenuesPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
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
  const mode = (await searchParams).mode === "create" ? "create" : "list";
  return (
    <section className="admin-shell px-5 py-10 sm:px-8 sm:py-14">
      <div className="relative mx-auto max-w-3xl pt-8">
        <ContextualBack />
        <div className="admin-page-header">
          <h1>Venues</h1>
          <p>Manage physical locations and their local timezones.</p>
          <SegmentedNavigation
            listLabel="Venues"
            actionLabel="Create"
            actionHref="/admin/venues?mode=create"
          />
        </div>
        {admin.role === "SYSTEM_ADMIN" && mode === "create" ? (
          <form
            action={createVenueForm}
            className="admin-surface mt-8 grid gap-3 rounded-3xl p-6 sm:grid-cols-2"
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
        {mode === "list" ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {(visibleVenues ?? []).map((venue) => (
              <article
                key={venue.id}
                className="admin-surface flex items-center justify-between rounded-3xl p-5"
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
                    <Button type="submit" variant="destructive">
                      Archive
                    </Button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
