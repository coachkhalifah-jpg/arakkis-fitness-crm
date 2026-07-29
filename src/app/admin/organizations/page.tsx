import { requireActiveAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { archiveOrganizationForm, createOrganizationForm } from "@/lib/services/phase-3-actions";
import { Button } from "@/components/ui/button";

export default async function OrganizationsPage() {
  const admin = await requireActiveAdmin();
  const db = await createClient();
  const { data: organizations } = await db
    .from("organizations")
    .select("id,name,organization_type,active_status,city,state")
    .order("name");
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-ink">Organizations</h1>
      <p className="mt-2 text-slate-600">
        System Admin organization management and scoped Host Admin visibility.
      </p>
      {admin.role === "SYSTEM_ADMIN" ? (
        <form
          action={createOrganizationForm}
          className="mt-8 grid gap-3 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2"
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
      <div className="mt-8 space-y-3">
        {(organizations ?? []).map((org) => (
          <article
            key={org.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4"
          >
            <div>
              <h2 className="font-medium">{org.name}</h2>
              <p className="text-sm text-slate-500">
                {org.city ? `${org.city}, ${org.state ?? ""}` : "No address"} · {org.active_status}
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
    </section>
  );
}
