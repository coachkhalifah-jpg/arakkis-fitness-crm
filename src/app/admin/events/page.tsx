import { requireActiveAdmin } from "@/lib/authorization/server";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { copyEventForm, createEventForm, cancelEventForm } from "@/lib/services/phase-3-actions";
import { publishPhase7EventForm, unpublishPhase7EventForm } from "@/lib/services/phase-7-actions";
import { Button } from "@/components/ui/button";
import { SegmentedNavigation } from "@/components/admin/segmented-navigation";
import { ContextualBack } from "@/components/admin/contextual-back";
import { RosterDrawer } from "@/components/admin/roster-drawer";
import { eventCardAsset } from "@/lib/config/admin-visual-assets";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
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
        "id,name,status,publication_status,public_slug,starts_at,ends_at,timezone,capacity,registration_deadline,host_organization_id,venue_id,event_series_id,event_series(public_slug)",
      )
      .order("starts_at", { ascending: false }),
  ]);
  const visibleEvents =
    admin.role === "SYSTEM_ADMIN"
      ? events
      : (events ?? []).filter((event) =>
          admin.organizationIds.includes(event.host_organization_id),
        );
  const mode = (await searchParams).mode === "create" ? "create" : "list";
  const { data: registrationRows } = await db
    .from("registrations")
    .select("event_id,registration_status,attendance(status)");
  const counts = new Map<string, { booked: number; checkedIn: number }>();
  for (const row of registrationRows ?? []) {
    const current = counts.get(row.event_id) ?? { booked: 0, checkedIn: 0 };
    if (row.registration_status === "REGISTERED") current.booked += 1;
    const attendance = Array.isArray(row.attendance) ? row.attendance[0] : row.attendance;
    if (attendance?.status === "ATTENDED") current.checkedIn += 1;
    counts.set(row.event_id, current);
  }
  const eventIds = (visibleEvents ?? []).map((event) => event.id);
  const { data: rosterRows } = eventIds.length
    ? await db
        .from("registrations")
        .select(
          "id,event_id,participant_id,registration_status,participants(id,first_name,last_name,display_phone),attendance(status)",
        )
        .in("event_id", eventIds)
    : { data: [] };
  const rosterByEvent = new Map<
    string,
    Array<{
      id: string;
      name: string;
      phone: string | null;
      attended: boolean;
      firstClass: boolean;
    }>
  >();
  const rosterParticipantIds = [
    ...new Set(((rosterRows ?? []) as Array<any>).map((row) => row.participant_id)),
  ];
  const { data: priorAttendance } = rosterParticipantIds.length
    ? await db
        .from("attendance")
        .select("status,registrations!inner(participant_id,events!inner(starts_at))")
        .eq("status", "ATTENDED")
        .in("registrations.participant_id", rosterParticipantIds)
    : { data: [] };
  const priorAttendanceByParticipant = new Map<string, number[]>();
  for (const row of (priorAttendance ?? []) as Array<any>) {
    const registration = Array.isArray(row.registrations)
      ? row.registrations[0]
      : row.registrations;
    const start = registration?.events?.starts_at;
    if (registration?.participant_id && start)
      priorAttendanceByParticipant.set(registration.participant_id, [
        ...(priorAttendanceByParticipant.get(registration.participant_id) ?? []),
        Date.parse(start),
      ]);
  }
  for (const row of (rosterRows ?? []) as Array<any>) {
    if (row.registration_status !== "REGISTERED") continue;
    const participant = Array.isArray(row.participants) ? row.participants[0] : row.participants;
    if (!participant) continue;
    const attendance = Array.isArray(row.attendance) ? row.attendance[0] : row.attendance;
    const people = rosterByEvent.get(row.event_id) ?? [];
    const currentEvent = (visibleEvents ?? []).find((event) => event.id === row.event_id);
    const currentStart = currentEvent
      ? Date.parse(currentEvent.starts_at)
      : Number.POSITIVE_INFINITY;
    const priorStarts = priorAttendanceByParticipant.get(row.participant_id) ?? [];
    people.push({
      id: row.id,
      name: `${participant.first_name} ${participant.last_name}`,
      phone: participant.display_phone ?? null,
      attended: attendance?.status === "ATTENDED",
      firstClass: !priorStarts.some((start) => start < currentStart),
    });
    rosterByEvent.set(row.event_id, people);
  }
  return (
    <section className="admin-shell px-5 py-10 sm:px-8 sm:py-14">
      <div className="relative mx-auto max-w-6xl pt-8">
        <ContextualBack />
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="admin-eyebrow">Operational workspace</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Events</h1>
            <p className="mt-3 max-w-2xl text-admin-text-muted">
              Create, publish, and manage your event calendar.
            </p>
          </div>
          <SegmentedNavigation
            listLabel="Events"
            actionLabel="Create"
            actionHref="/admin/events?mode=create"
          />
        </div>
        {admin.role === "SYSTEM_ADMIN" && mode === "create" ? (
          <form
            action={createEventForm}
            className="admin-surface mt-8 grid gap-5 rounded-3xl p-6 sm:grid-cols-2 sm:p-8"
          >
            <h2 className="admin-eyebrow sm:col-span-2">Create draft event</h2>
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
            <fieldset className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
              <legend className="px-1 text-sm font-semibold text-ink">Repeat</legend>
              <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
                <label className="flex min-h-10 items-center gap-2 sm:col-span-1">
                  <input name="recurring" type="checkbox" className="h-4 w-4 accent-brand" />
                  <span>Make this event recurring</span>
                </label>
                <label>
                  Frequency
                  <select
                    name="recurrenceFrequency"
                    defaultValue="WEEKLY"
                    className="mt-1 w-full rounded border bg-white p-2"
                    disabled
                  >
                    <option value="WEEKLY">Every week</option>
                  </select>
                </label>
                <label>
                  Ends
                  <input
                    name="recurrenceEndsOn"
                    type="date"
                    className="mt-1 w-full rounded border bg-white p-2"
                    aria-describedby="recurrence-help"
                  />
                </label>
              </div>
              <p id="recurrence-help" className="mt-2 text-xs text-slate-500">
                Weekly dates are created through this end date. Participants can select dates only
                within the next 14 days from the series link.
              </p>
            </fieldset>
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
            <label>
              Communication link (optional)
              <input
                name="communicationUrl"
                type="url"
                placeholder="https://chat.whatsapp.com/..."
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <label>
              Link label
              <input
                name="communicationLabel"
                placeholder="Join the WhatsApp Group"
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <Button type="submit">Create draft</Button>
          </form>
        ) : null}
        {mode === "list" ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {(visibleEvents ?? []).map((event) => {
              const venue = venues?.find((item) => item.id === event.venue_id);
              const seriesSlug = event.event_series?.[0]?.public_slug ?? null;
              const publicSlug = event.public_slug ?? seriesSlug;
              const count = counts.get(event.id) ?? { booked: 0, checkedIn: 0 };
              const people = rosterByEvent.get(event.id) ?? [];
              const durationMinutes = Math.max(
                0,
                Math.round(
                  (new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()) / 60000,
                ),
              );
              const firstClassCount = people.filter((person) => person.firstClass).length;
              return (
                <article
                  key={event.id}
                  className={`admin-surface overflow-hidden rounded-3xl ${event.status === "CANCELLED" ? "opacity-75" : ""}`}
                >
                  <div
                    className="event-card-image relative"
                    style={{
                      backgroundImage: `linear-gradient(135deg, rgba(22,34,30,.25), rgba(22,34,30,.62)), url(${eventCardAsset(event.name)})`,
                    }}
                  >
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <p className="text-xs font-bold uppercase tracking-[.16em] text-white/75">
                        {event.status}
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold">
                        <Link href={`/admin/events/${event.id}`}>{event.name}</Link>
                      </h2>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-sm text-admin-text-muted">
                      {venue?.name ?? "Venue"} ·{" "}
                      {new Intl.DateTimeFormat("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: event.timezone,
                      }).format(new Date(event.starts_at))}{" "}
                      · {event.timezone}
                    </p>
                    <p className="mt-1 text-sm text-admin-text-muted">
                      {durationMinutes} minute class
                      {event.event_series_id ? " · recurring weekly" : ""}
                    </p>
                    <div className="mt-5 rounded-2xl bg-admin-surface-muted p-3">
                      <p className="text-xs font-bold uppercase tracking-[.12em] text-admin-text-muted">
                        Registration roster
                      </p>
                      <div className="mt-2 grid grid-cols-4 gap-2 text-center text-sm">
                        <div>
                          <strong className="block text-lg">{count.booked}</strong>
                          <span className="text-admin-text-muted">Booked</span>
                        </div>
                        <div>
                          <strong className="block text-lg">{firstClassCount}</strong>
                          <span className="text-admin-text-muted">First Classes</span>
                        </div>
                        <div>
                          <strong className="block text-lg">{count.checkedIn}</strong>
                          <span className="text-admin-text-muted">Checked In</span>
                        </div>
                        <div>
                          <strong className="block text-lg">
                            {Math.max(0, event.capacity - count.booked)}
                          </strong>
                          <span className="text-admin-text-muted">Spots Left</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link className="admin-primary-button" href={`/admin/events/${event.id}`}>
                        Manage event
                      </Link>
                      <RosterDrawer
                        eventName={event.name}
                        people={people}
                        canViewPhone={admin.role === "SYSTEM_ADMIN" || admin.role === "HOST_ADMIN"}
                        fullRosterHref={`/admin/events/${event.id}`}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {admin.role === "SYSTEM_ADMIN" &&
                      event.status !== "CANCELLED" &&
                      event.publication_status !== "PUBLISHED" ? (
                        <form action={publishPhase7EventForm.bind(null, event.id)}>
                          <Button type="submit">Publish</Button>
                        </form>
                      ) : null}
                      {admin.role === "SYSTEM_ADMIN" && event.publication_status === "PUBLISHED" ? (
                        <form action={unpublishPhase7EventForm.bind(null, event.id)}>
                          <Button type="submit">Unpublish</Button>
                        </form>
                      ) : null}
                      {publicSlug ? (
                        <Link
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                          href={`/register/${publicSlug}`}
                        >
                          Preview
                        </Link>
                      ) : null}
                      {publicSlug ? (
                        <a
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                          href={`/admin/events/${event.id}/qr`}
                        >
                          QR
                        </a>
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
        ) : null}
      </div>
    </section>
  );
}
