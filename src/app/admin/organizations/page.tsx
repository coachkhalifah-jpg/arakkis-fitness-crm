import { requireActiveAdmin } from "@/lib/authorization/server";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { archiveOrganizationForm, createOrganizationForm } from "@/lib/services/phase-3-actions";
import { Button } from "@/components/ui/button";
import { SegmentedNavigation } from "@/components/admin/segmented-navigation";
import { ContextualBack } from "@/components/admin/contextual-back";

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const admin = await requireActiveAdmin();
  const db = await createClient();
  const { data: organizations } = await db
    .from("organizations")
    .select("id,name,organization_type,active_status,city,state")
    .order("name");
  const mode = (await searchParams).mode === "create" ? "create" : "list";
  return (
    <section className="admin-shell px-5 py-10 sm:px-8 sm:py-14">
      <div className="relative mx-auto max-w-6xl pt-8">
        <ContextualBack />
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="admin-eyebrow">Workspace settings</p>
            <h1 className="mt-2 text-4xl font-semibold">Organizations</h1>
            <p className="mt-3 text-admin-text-muted">
              Keep host organizations and their operating details organized.
            </p>
          </div>
          <SegmentedNavigation
            listLabel="Organizations"
            actionLabel="Create"
            actionHref="/admin/organizations?mode=create"
          />
        </div>
        {admin.role === "SYSTEM_ADMIN" && mode === "create" ? (
          <form
            action={createOrganizationForm}
            className="admin-surface mt-8 grid gap-3 rounded-3xl p-6 sm:grid-cols-2"
          >
            <h2 className="sm:col-span-2 text-lg font-semibold">Create organization</h2>
            <label>
              Name
              <input
                name="name"
                required
                maxLength={200}
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <label>
              Type
              <input name="organizationType" className="mt-1 w-full rounded border p-2" />
            </label>
            <label>
              Street
              <input name="street" className="mt-1 w-full rounded border p-2" />
            </label>
            <label>
              City
              <input name="city" className="mt-1 w-full rounded border p-2" />
            </label>
            <label>
              State
              <input name="state" className="mt-1 w-full rounded border p-2" />
            </label>
            <label>
              Postal code
              <input name="postalCode" className="mt-1 w-full rounded border p-2" />
            </label>
            <Button type="submit">Create organization</Button>
          </form>
        ) : null}
        {mode === "list" ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {(organizations ?? []).map((org) => (
              <article
                key={org.id}
                className="admin-surface flex items-center justify-between rounded-3xl p-5"
              >
                <div>
                  <h2 className="font-medium">
                    <Link className="text-brand" href={`/admin/organizations/${org.id}`}>
                      {org.name}
                    </Link>
                  </h2>
                  <p className="text-sm text-slate-500">
                    {org.city ? `${org.city}, ${org.state ?? ""}` : "No address"} ·{" "}
                    {org.active_status}
                  </p>
                </div>
                {admin.role === "SYSTEM_ADMIN" && org.active_status !== "ARCHIVED" ? (
                  <form action={archiveOrganizationForm.bind(null, org.id)}>
                    <Button type="submit">Archive</Button>
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
