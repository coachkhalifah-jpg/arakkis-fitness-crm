import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveAdmin, requireOrganizationAccess } from "@/lib/authorization/server";
import { createClient } from "@/lib/db/server";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/admin/submit-button";
import { WalkInForm } from "@/components/admin/walk-in-form";
import { CopyLinkButton } from "@/components/admin/copy-link-button";
import {
  RegistrationRoster,
  type RegistrationRosterRow,
} from "@/components/admin/registration-roster";
import { ContextualBack } from "@/components/admin/contextual-back";
import {
  RosterStatusCarousel,
  type RosterPreviewPerson,
} from "@/components/admin/roster-status-carousel";
import {
  cancelEventForm,
  copyEventForm,
  createWalkInSubmit,
  finalizeAttendanceSubmit,
  openAttendanceSubmit,
  publishEventForm,
  reopenAttendanceSubmit,
  updateEvent,
  setOccurrenceLocationOverrideSubmit,
} from "@/lib/services/phase-3-actions";
import {
  pausePhase7EventForm,
  phase7EventUrl,
  publishPhase7EventForm,
  resumePhase7EventForm,
  setPhase7SlugForm,
  unpublishPhase7EventForm,
} from "@/lib/services/phase-7-actions";

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
  const { data: eventSeries } = event.event_series_id
    ? await db
        .from("event_series")
        .select("id,frequency,ends_on,selection_window_days,public_slug")
        .eq("id", event.event_series_id)
        .maybeSingle()
    : { data: null };
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
    .select(
      "id,participant_id,registered_at,registration_status,registration_outcome,registration_group_id",
    )
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
  const registrationIds = (registrations ?? []).map((registration) => registration.id);
  const { data: attendance } = registrationIds.length
    ? await db
        .from("attendance")
        .select("id,registration_id,status,checked_in_at,finalized_at,updated_at")
        .in("registration_id", registrationIds)
    : { data: [] };
  const attendanceByRegistration = new Map(
    (attendance ?? []).map((row) => [row.registration_id, row]),
  );
  const { data: priorAttendance } = participantIds.length
    ? await db
        .from("attendance")
        .select("status,registrations!inner(participant_id,events!inner(starts_at))")
        .eq("status", "ATTENDED")
        .in("registrations.participant_id", participantIds)
        .lt("registrations.events.starts_at", event.starts_at)
    : { data: [] };
  const firstClassParticipantIds = new Set(
    (priorAttendance ?? [])
      .map((row) => {
        const registration = Array.isArray(row.registrations)
          ? row.registrations[0]
          : row.registrations;
        return registration?.participant_id;
      })
      .filter(Boolean),
  );
  const [{ data: participationVersion }, { data: dataUseVersion }] = await Promise.all([
    db
      .from("acknowledgment_versions")
      .select("id")
      .eq("type", "PARTICIPATION_RISK")
      .in("legal_status", ["APPROVED", "PROVISIONAL"])
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("acknowledgment_versions")
      .select("id")
      .eq("type", "DATA_USE")
      .in("legal_status", ["APPROVED", "PROVISIONAL"])
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const canEdit =
    admin.role === "SYSTEM_ADMIN" && event.status !== "CANCELLED" && event.status !== "COMPLETED";
  const canonicalSlug = event.public_slug ?? eventSeries?.public_slug ?? null;
  const publicUrl = canonicalSlug ? await phase7EventUrl(canonicalSlug) : null;
  const rosterPreview: RosterPreviewPerson[] = (registrations ?? []).map((registration) => {
    const participant = participantById.get(registration.participant_id);
    return {
      id: registration.id,
      name: participant
        ? `${participant.first_name} ${participant.last_name}`
        : "Participant unavailable",
      phone: participant?.display_phone ?? null,
      registrationStatus: registration.registration_status,
      attendanceStatus: attendanceByRegistration.get(registration.id)?.status ?? "NOT_RECORDED",
      firstClass: Boolean(participant && !firstClassParticipantIds.has(participant.id)),
    };
  });
  const rosterRows: RegistrationRosterRow[] = (registrations ?? []).map((registration) => {
    const participant = participantById.get(registration.participant_id);
    return {
      id: registration.id,
      participantName: participant
        ? `${participant.first_name} ${participant.last_name}`
        : "Participant unavailable",
      phone: participant?.display_phone ?? "",
      email: participant?.email ?? "",
      registrationStatus: registration.registration_status,
      attendanceStatus: attendanceByRegistration.get(registration.id)?.status ?? "NOT_RECORDED",
      registeredAt: new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(registration.registered_at)),
      firstClass: Boolean(participant && !firstClassParticipantIds.has(participant.id)),
    };
  });
  return (
    <section className="admin-shell px-5 py-10 sm:px-8 sm:py-14">
      <div className="relative mx-auto max-w-3xl pt-8">
        <ContextualBack href="/admin/events" label="Events" />
        <div className="admin-page-header">
          <h1>{event.name}</h1>
          <p>
            {event.status} ·{" "}
            {new Intl.DateTimeFormat("en-US", {
              dateStyle: "full",
              timeStyle: "short",
              timeZone: event.timezone,
            }).format(new Date(event.starts_at))}{" "}
            · {event.timezone}
          </p>
        </div>
        <div className="mt-6 rounded-lg border border-brand/30 bg-brand/5 p-6">
          <h2 className="text-lg font-semibold">Publishing and registration link</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Publication</dt>
              <dd>{event.publication_status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Registration</dt>
              <dd>{event.registration_paused_at ? "PAUSED" : event.publication_status}</dd>
            </div>
            {eventSeries ? (
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Recurring schedule</dt>
                <dd>
                  Every week through {eventSeries.ends_on} · participants can choose 14 days at a
                  time
                </dd>
              </div>
            ) : null}
          </dl>
          {admin.role === "SYSTEM_ADMIN" && event.status !== "CANCELLED" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {event.publication_status === "PUBLISHED" ? (
                <form action={unpublishPhase7EventForm.bind(null, id)}>
                  <Button type="submit">Unpublish</Button>
                </form>
              ) : (
                <form action={publishPhase7EventForm.bind(null, id)}>
                  <Button type="submit">Publish</Button>
                </form>
              )}
              {event.registration_paused_at ? (
                <form action={resumePhase7EventForm}>
                  <input type="hidden" name="eventId" value={id} />
                  <Button type="submit">Resume registration</Button>
                </form>
              ) : (
                <form action={pausePhase7EventForm}>
                  <input type="hidden" name="eventId" value={id} />
                  <Button type="submit">Pause registration</Button>
                </form>
              )}
              {publicUrl ? (
                <a
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  href={publicUrl}
                >
                  Share Registration
                </a>
              ) : null}
              {publicUrl ? <CopyLinkButton url={publicUrl} /> : null}
              {canonicalSlug ? (
                <a
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  href={`/admin/events/${id}/qr`}
                >
                  Download QR
                </a>
              ) : null}
            </div>
          ) : null}
          {publicUrl ? (
            <p className="mt-3 break-all text-sm text-slate-600" data-testid="canonical-url">
              {publicUrl}
            </p>
          ) : null}
          {canEdit ? (
            <form action={setPhase7SlugForm.bind(null, id)} className="mt-4 flex gap-2">
              <label className="sr-only" htmlFor="publicSlug">
                Public slug
              </label>
              <input
                id="publicSlug"
                name="publicSlug"
                defaultValue={canonicalSlug ?? ""}
                className="min-w-0 flex-1 rounded border p-2"
              />
              <Button type="submit">Save slug</Button>
            </form>
          ) : null}
        </div>
        {event.status === "CANCELLED" ? (
          <p className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-red-800">
            This event is permanently cancelled and cannot be restored. Copy it to create a separate
            draft.
          </p>
        ) : null}
        {event.status !== "CANCELLED" && event.status !== "DRAFT" ? (
          <div className="mt-6 rounded-lg border border-brand/30 bg-brand/5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Attendance operations</h2>
                <p className="text-sm text-slate-600">
                  {event.attendance_processing_state} ·{" "}
                  {
                    (registrations ?? []).filter((r) => r.registration_status === "REGISTERED")
                      .length
                  }{" "}
                  active registrations / {event.capacity} capacity
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {event.attendance_processing_state !== "FINALIZED" ? (
                  <form action={openAttendanceSubmit}>
                    <input type="hidden" name="eventId" value={id} />
                    <SubmitButton>Start check-in</SubmitButton>
                  </form>
                ) : null}
                {event.attendance_processing_state === "OPEN" ||
                event.attendance_processing_state === "REOPENED" ? (
                  <form action={finalizeAttendanceSubmit}>
                    <input type="hidden" name="eventId" value={id} />
                    <ConfirmSubmit message="Finalize attendance? Every active unmarked registration will become No-Show.">
                      Finalize attendance
                    </ConfirmSubmit>
                  </form>
                ) : null}
                {admin.role === "SYSTEM_ADMIN" &&
                event.attendance_processing_state === "FINALIZED" ? (
                  <form action={reopenAttendanceSubmit} className="flex gap-2">
                    <input type="hidden" name="eventId" value={id} />
                    <input
                      name="reason"
                      required
                      placeholder="Reopen reason"
                      className="rounded border p-2 text-sm"
                    />
                    <ConfirmSubmit message="Reopen attendance for correction?">
                      Reopen
                    </ConfirmSubmit>
                  </form>
                ) : null}
              </div>
            </div>
            {event.attendance_processing_state === "FINALIZED" ? (
              <Alert className="mt-4">
                Attendance is finalized. Authorized Host Admins may correct individual results for
                this event with a reason. Only System Admins may reopen the entire event.
              </Alert>
            ) : null}
          </div>
        ) : null}
        {event.status !== "CANCELLED" && event.attendance_processing_state === "OPEN" ? (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Add walk-in</h2>
            <p className="mt-1 text-sm text-slate-600">
              A walk-in is matched or created, registered, and checked in atomically.
            </p>
            <WalkInForm
              eventId={id}
              participationVersionId={participationVersion?.id ?? ""}
              dataUseVersionId={dataUseVersion?.id ?? ""}
            />
          </div>
        ) : null}
        <RosterStatusCarousel people={rosterPreview} />
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Event details</h2>
          {admin.role === "SYSTEM_ADMIN" ? (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-semibold text-amber-950">Occurrence location</h3>
              <p className="mt-1 text-sm text-amber-900">
                This changes this occurrence only; the series and other dates keep their locations.
              </p>
              <form
                action={setOccurrenceLocationOverrideSubmit}
                className="mt-3 flex flex-wrap gap-2"
              >
                <input type="hidden" name="eventId" value={id} />
                <select
                  name="venueId"
                  defaultValue={event.location_override_venue_id ?? event.venue_id}
                  className="rounded border p-2 text-sm"
                >
                  {(venues ?? []).map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name} ({venue.timezone})
                    </option>
                  ))}
                </select>
                <input
                  name="note"
                  placeholder="Optional location note"
                  className="rounded border p-2 text-sm"
                  maxLength={200}
                />
                <button
                  type="submit"
                  className="rounded bg-brand px-3 py-2 text-sm font-semibold text-white"
                >
                  Save occurrence location
                </button>
              </form>
            </div>
          ) : null}
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
                What to bring &amp; arrival notes (optional)
                <textarea
                  name="participantInstructions"
                  defaultValue={event.participant_instructions ?? ""}
                  className="mt-1 min-h-20 w-full rounded border p-2"
                  aria-describedby="participant-instructions-help"
                />
                <span
                  id="participant-instructions-help"
                  className="mt-1 block text-xs text-admin-text-muted"
                >
                  Use one plain-text item per line. These notes appear on the public event and
                  booking confirmation.
                </span>
              </label>
              <label>
                Communication link (optional)
                <input
                  name="communicationUrl"
                  type="url"
                  defaultValue={event.communication_url ?? ""}
                  placeholder="https://..."
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <label>
                Link label
                <input
                  name="communicationLabel"
                  defaultValue={event.communication_label ?? ""}
                  placeholder="Join the group"
                  className="mt-1 w-full rounded border p-2"
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
          <RegistrationRoster
            eventId={id}
            rows={rosterRows}
            canEdit={
              event.status !== "CANCELLED" &&
              (event.attendance_processing_state === "OPEN" ||
                event.attendance_processing_state === "REOPENED" ||
                event.attendance_processing_state === "FINALIZED")
            }
            requiresReason={event.attendance_processing_state === "FINALIZED"}
          />
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
                <ConfirmSubmit
                  message="Cancel this event permanently? It cannot be restored."
                  variant="destructive"
                >
                  Cancel event
                </ConfirmSubmit>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
