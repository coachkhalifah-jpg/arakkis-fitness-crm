import { requireActiveAdmin } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import {
  cancelEventForm,
  copyEventForm,
  createEventForm,
  publishEventForm,
} from "@/lib/services/phase-3-actions";
import { Button } from "@/components/ui/button";

export default async function EventsPage() {
  const admin = await requireActiveAdmin();
  const db = await createClient();
  const [{ data: organizations }, { data: venues }, { data: events }] = await Promise.all([
    db.from("organizations").select("id,name").eq("active_status", "ACTIVE").order("name"),
    db
      .from("venues")
      .select("id,name,organization_id,timezone")
      .eq("active_status", "ACTIVE")
      .order("name"),
    db
      .from("events")
      .select(
        "id,name,status,starts_at,ends_at,timezone,capacity,registration_deadline,host_organization_id,venue_id",
      )
      .order("starts_at", { ascending: false }),
  ]);
  const visibleEvents =
    admin.role === "SYSTEM_ADMIN"
      ? events
      : (events ?? []).filter((event) =>
          admin.organizationIds.includes(event.host_organization_id),
        );
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-ink">Events</h1>
      <p className="mt-2 text-slate-600">
        Create drafts, publish valid events, copy events, and permanently cancel events.
      </p>
      {admin.role === "SYSTEM_ADMIN" ? (
        <form
          action={createEventForm}
          className="mt-8 grid gap-3 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2"
        >
          <h2 className="sm:col-span-2 text-lg font-semibold">Create draft event</h2>
          <label>
            Name
            <input name="name" required className="mt-1 w-full rounded border p-2" />
          </label>
          <label>
            Organization
            <select name="hostOrganizationId" required className="mt-1 w-full rounded border p-2">
              <option value="">Select organization</option>
              {(organizations ?? []).map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Venue
            <select name="venueId" required className="mt-1 w-full rounded border p-2">
              <option value="">Select venue</option>
              {(venues ?? []).map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name} ({venue.timezone})
                </option>
              ))}
            </select>
          </label>
          <label>
            Capacity
            <input
              name="capacity"
              type="number"
              min="1"
              required
              defaultValue="20"
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <label>
            Local start
            <input
              name="startLocal"
              type="datetime-local"
              required
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <label>
            Local end
            <input
              name="endLocal"
              type="datetime-local"
              required
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <label>
            Registration deadline
            <input
              name="registrationDeadlineLocal"
              type="datetime-local"
              required
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <label>
            Visibility
            <select name="visibility" className="mt-1 w-full rounded border p-2">
              <option value="PUBLIC">Public</option>
              <option value="AFFILIATION_RESTRICTED">Affiliation restricted</option>
            </select>
          </label>
          <label className="sm:col-span-2">
            Description
            <textarea name="description" className="mt-1 min-h-20 w-full rounded border p-2" />
          </label>
          <Button type="submit">Create draft</Button>
        </form>
      ) : null}
      <div className="mt-8 space-y-3">
        {(visibleEvents ?? []).map((event) => {
          const venue = venues?.find((item) => item.id === event.venue_id);
          return (
            <article key={event.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{event.name}</h2>
                  <p className="text-sm text-slate-500">
                    {venue?.name ?? "Venue"} ·{" "}
                    {new Intl.DateTimeFormat("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: event.timezone,
                    }).format(new Date(event.starts_at))}{" "}
                    · {event.timezone}
                  </p>
                  <p className="text-sm text-slate-500">
                    {event.status} · capacity {event.capacity}
                  </p>
                </div>
                <div className="flex gap-2">
                  {admin.role === "SYSTEM_ADMIN" && event.status === "DRAFT" ? (
                    <form action={publishEventForm.bind(null, event.id)}>
                      <Button type="submit">Publish</Button>
                    </form>
                  ) : null}
                  {admin.role === "SYSTEM_ADMIN" && event.status !== "CANCELLED" ? (
                    <form action={copyEventForm.bind(null, event.id)}>
                      <Button type="submit">Copy</Button>
                    </form>
                  ) : null}
                  {admin.role === "SYSTEM_ADMIN" &&
                  event.status !== "CANCELLED" &&
                  event.status !== "COMPLETED" ? (
                    <form action={cancelEventForm.bind(null, event.id)}>
                      <Button type="submit">Cancel</Button>
                    </form>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
