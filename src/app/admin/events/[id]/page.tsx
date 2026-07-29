import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveAdmin, requireOrganizationAccess } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { Button } from "@/components/ui/button";
import {
  cancelEventForm,
  copyEventForm,
  publishEventForm,
  updateEvent,
} from "@/lib/services/phase-3-actions";

function localValue(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(new Date(value))
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const { data: event } = await db.from("events").select("*").eq("id", id).single();
  if (!event) {
    const admin = await requireActiveAdmin(`/admin/events/${id}`);
    if (admin.role === "HOST_ADMIN") {
      redirect("/admin/access-denied");
    }
    return <p className="mx-auto max-w-5xl px-6 py-12">Event not found.</p>;
  }
  const admin = await requireOrganizationAccess(event.host_organization_id, `/admin/events/${id}`);
  const [{ data: organizations }, { data: venues }] = await Promise.all([
    db.from("organizations").select("id,name").eq("active_status", "ACTIVE").order("name"),
    db
      .from("venues")
      .select("id,name,organization_id,timezone")
      .eq("active_status", "ACTIVE")
      .order("name"),
  ]);
  const { data: registrations } = await db
    .from("registrations")
    .select("id,participant_id,registered_at,registration_status,registration_outcome")
    .eq("event_id", id)
    .order("registered_at");
  const participantIds = (registrations ?? []).map((registration) => registration.participant_id);
  const { data: participants } = participantIds.length
    ? await db
        .from("participants")
        .select("id,first_name,last_name,display_phone,email,primary_affiliation_organization_id")
        .in("id", participantIds)
    : { data: [] };
  const participantById = new Map(
    (participants ?? []).map((participant) => [participant.id, participant]),
  );
  const canEdit =
    admin.role === "SYSTEM_ADMIN" && event.status !== "CANCELLED" && event.status !== "COMPLETED";
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <Link className="text-sm text-brand" href="/admin/events">
        ← Events
      </Link>
      <h1 className="mt-3 text-3xl font-semibold text-ink">{event.name}</h1>
      <p className="mt-2 text-slate-600">
        {event.status} ·{" "}
        {new Intl.DateTimeFormat("en-US", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: event.timezone,
        }).format(new Date(event.starts_at))}{" "}
        · {event.timezone}
      </p>
      {event.status === "CANCELLED" ? (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-red-800">
          This event is permanently cancelled and cannot be restored. Copy it to create a separate
          draft.
        </p>
      ) : null}
      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Event details</h2>
        {canEdit ? (
          <ActionForm action={updateEvent} submitLabel="Save event">
            <input type="hidden" name="id" value={id} />
            <label>
              Name
              <input
                name="name"
                required
                defaultValue={event.name}
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <label>
              Organization
              <select
                name="hostOrganizationId"
                defaultValue={event.host_organization_id}
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
              Venue
              <select
                name="venueId"
                defaultValue={event.venue_id}
                className="mt-1 w-full rounded border p-2"
              >
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
                defaultValue={event.capacity}
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <label>
              Local start
              <input
                name="startLocal"
                type="datetime-local"
                required
                defaultValue={localValue(event.starts_at, event.timezone)}
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <label>
              Local end
              <input
                name="endLocal"
                type="datetime-local"
                required
                defaultValue={localValue(event.ends_at, event.timezone)}
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <label>
              Registration deadline
              <input
                name="registrationDeadlineLocal"
                type="datetime-local"
                required
                defaultValue={localValue(event.registration_deadline, event.timezone)}
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <label>
              Visibility
              <select
                name="visibility"
                defaultValue={event.visibility}
                className="mt-1 w-full rounded border p-2"
              >
                <option value="PUBLIC">Public</option>
                <option value="AFFILIATION_RESTRICTED">Affiliation restricted</option>
              </select>
            </label>
            <label>
              Description
              <textarea
                name="description"
                defaultValue={event.description ?? ""}
                className="mt-1 min-h-20 w-full rounded border p-2"
              />
            </label>
            <label>
              Participant instructions
              <textarea
                name="participantInstructions"
                defaultValue={event.participant_instructions ?? ""}
                className="mt-1 min-h-20 w-full rounded border p-2"
              />
            </label>
          </ActionForm>
        ) : (
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Capacity</dt>
              <dd>{event.capacity}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Registration deadline</dt>
              <dd>
                {new Intl.DateTimeFormat("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: event.timezone,
                }).format(new Date(event.registration_deadline))}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Description</dt>
              <dd>{event.description || "—"}</dd>
            </div>
          </dl>
        )}
      </div>
      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Registration roster</h2>
        <p className="mt-1 text-sm text-slate-600">
          {
            (registrations ?? []).filter(
              (registration) => registration.registration_status === "REGISTERED",
            ).length
          }{" "}
          active registrations · Host-scoped operational view
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">Participant</th>
                <th className="p-2">Phone</th>
                <th className="p-2">Email</th>
                <th className="p-2">Status</th>
                <th className="p-2">Registered</th>
              </tr>
            </thead>
            <tbody>
              {(registrations ?? []).map((registration) => {
                const participant = participantById.get(registration.participant_id);
                return (
                  <tr key={registration.id} className="border-b last:border-0">
                    <td className="p-2">
                      {participant
                        ? `${participant.first_name} ${participant.last_name}`
                        : "Participant unavailable"}
                    </td>
                    <td className="p-2">{participant?.display_phone ?? "—"}</td>
                    <td className="p-2">{participant?.email ?? "—"}</td>
                    <td className="p-2">{registration.registration_status}</td>
                    <td className="p-2">
                      {new Intl.DateTimeFormat("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(registration.registered_at))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {admin.role === "SYSTEM_ADMIN" ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {event.status === "DRAFT" ? (
            <form action={publishEventForm.bind(null, id)}>
              <Button type="submit">Publish event</Button>
            </form>
          ) : null}
          {event.status !== "CANCELLED" ? (
            <form action={copyEventForm.bind(null, id)}>
              <ConfirmSubmit message="Copy this event into a new draft? Registrations and history will not be copied.">
                Copy event
              </ConfirmSubmit>
            </form>
          ) : null}
          {event.status !== "CANCELLED" && event.status !== "COMPLETED" ? (
            <form action={cancelEventForm.bind(null, id)}>
              <ConfirmSubmit message="Cancel this event permanently? It cannot be restored.">
                Cancel event
              </ConfirmSubmit>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
