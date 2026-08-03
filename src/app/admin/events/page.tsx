import { requireActiveAdmin } from "@/lib/authorization/server";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import {
  copyEventForm,
  createEventForm,
  cancelEventForm,
  markAttendanceSubmit,
} from "@/lib/services/phase-3-actions";
import { publishPhase7EventForm, unpublishPhase7EventForm } from "@/lib/services/phase-7-actions";
import { Button } from "@/components/ui/button";
import { SegmentedNavigation } from "@/components/admin/segmented-navigation";
import { ContextualBack } from "@/components/admin/contextual-back";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { AdminEventCard } from "@/components/admin/admin-event-card";
import { AdminEventCardRail } from "@/components/admin/admin-event-card-rail";
import { eventCardAsset } from "@/lib/config/admin-visual-assets";
import { designAssetPublicUrl } from "@/lib/config/design-assets";

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
        "id,name,status,publication_status,public_slug,starts_at,ends_at,timezone,capacity,registration_deadline,host_organization_id,venue_id,event_series_id,attendance_processing_state,event_series(public_slug)",
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
  const { data: eventImageAssets } = eventIds.length
    ? await db
        .from("design_assets")
        .select("event_id,storage_path")
        .eq("asset_type", "EVENT_IMAGE_DESKTOP")
        .eq("active", true)
        .in("event_id", eventIds)
    : { data: [] };
  const eventImageById = new Map(
    (eventImageAssets ?? []).map((asset) => [
      asset.event_id,
      designAssetPublicUrl(asset.storage_path),
    ]),
  );
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
      <div className="relative mx-auto max-w-3xl pt-8">
        <ContextualBack />
        <div className="admin-page-header">
          <h1>Events</h1>
          <p>Create, publish, and manage your event calendar.</p>
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
            <label className="sm:col-span-2">
              What to bring &amp; arrival notes (optional)
              <textarea
                name="participantInstructions"
                className="mt-1 min-h-20 w-full rounded border p-2"
                aria-describedby="participant-instructions-help"
              />
              <span
                id="participant-instructions-help"
                className="mt-1 block text-xs text-admin-text-muted"
              >
                Use one plain-text item per line. These notes appear on the public event and booking
                confirmation.
              </span>
            </label>
            <label className="sm:col-span-2">
              Event card image (optional)
              <input
                name="eventImage"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="mt-1 block w-full rounded border border-dashed p-3"
              />
              <span className="mt-1 block text-xs text-admin-text-muted">
                This image becomes the event card and public class image. JPEG, PNG, WebP, or SVG up
                to 5 MiB.
              </span>
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
          <AdminEventCardRail>
            <div className="event-card-carousel mt-8 flex gap-4 overflow-x-auto pb-4">
              {(visibleEvents ?? []).map((event) => {
                const venue = venues?.find((item) => item.id === event.venue_id);
                const seriesSlug = event.event_series?.[0]?.public_slug ?? null;
                const publicSlug = event.public_slug ?? seriesSlug;
                const count = counts.get(event.id) ?? { booked: 0, checkedIn: 0 };
                const people = rosterByEvent.get(event.id) ?? [];
                const durationMinutes = Math.max(
                  0,
                  Math.round(
                    (new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()) /
                      60000,
                  ),
                );
                const firstClassCount = people.filter((person) => person.firstClass).length;
                const startsAt = new Intl.DateTimeFormat("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: event.timezone,
                }).format(new Date(event.starts_at));
                return (
                  <AdminEventCard
                    key={event.id}
                    event={{
                      id: event.id,
                      name: event.name,
                      status: event.status,
                      capacity: event.capacity,
                      eventSeriesId: event.event_series_id,
                    }}
                    venueName={venue?.name ?? "Venue"}
                    startsAt={startsAt}
                    durationMinutes={durationMinutes}
                    image={eventImageById.get(event.id) ?? eventCardAsset(event.name)}
                    count={count}
                    firstClassCount={firstClassCount}
                    people={people}
                    canCheckIn={
                      event.status !== "CANCELLED" &&
                      (event.attendance_processing_state === "OPEN" ||
                        event.attendance_processing_state === "REOPENED")
                    }
                    checkInAction={markAttendanceSubmit}
                    canViewPhone={admin.role === "SYSTEM_ADMIN" || admin.role === "HOST_ADMIN"}
                    actions={
                      <>
                        {admin.role === "SYSTEM_ADMIN" &&
                        event.status !== "CANCELLED" &&
                        event.publication_status !== "PUBLISHED" ? (
                          <form action={publishPhase7EventForm.bind(null, event.id)}>
                            <Button type="submit">Publish</Button>
                          </form>
                        ) : null}
                        {admin.role === "SYSTEM_ADMIN" &&
                        event.publication_status === "PUBLISHED" ? (
                          <form action={unpublishPhase7EventForm.bind(null, event.id)}>
                            <Button type="submit">Unpublish</Button>
                          </form>
                        ) : null}
                        {publicSlug ? (
                          <Link className="admin-secondary-button" href={`/register/${publicSlug}`}>
                            Preview
                          </Link>
                        ) : null}
                        {publicSlug ? (
                          <a
                            className="admin-secondary-button"
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
                      </>
                    }
                    cancelAction={
                      admin.role === "SYSTEM_ADMIN" &&
                      event.status !== "CANCELLED" &&
                      event.status !== "COMPLETED" ? (
                        <form
                          className="event-roster-cancel-form"
                          action={cancelEventForm.bind(null, event.id)}
                        >
                          <ConfirmSubmit
                            message="Cancel this class permanently? It cannot be restored."
                            variant="destructive"
                          >
                            Cancel
                          </ConfirmSubmit>
                        </form>
                      ) : null
                    }
                  />
                );
              })}
            </div>
          </AdminEventCardRail>
        ) : null}
      </div>
    </section>
  );
}
