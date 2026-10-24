import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveAdmin, requireOrganizationAccess } from "@/lib/authorization/server";
import { signOut } from "@/lib/auth/session-actions";
import { createClient } from "@/lib/db/server";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { Alert } from "@/components/ui/alert";
import { WalkInForm } from "@/components/admin/walk-in-form";
import type { RegistrationRosterRow } from "@/components/admin/registration-roster";
import { ContextualBack } from "@/components/admin/contextual-back";
import { OrganizationVenueFields, EventTimingFields } from "@/components/admin/event-form-fields";
import { DesignAssetUploadForm } from "@/components/admin/design-asset-upload-form";
import { SeriesMainImageForm } from "@/components/admin/series-main-image-form";
import { RosterPreview } from "@/components/admin/roster-preview";
import { CalendarUtility } from "@/components/admin/calendar-utility";
import { EventTitleOverlayControl } from "@/components/admin/event-title-overlay-control";
import {
  updateEvent,
  generateEventInviteLink,
  revokeEventInviteLinksForm,
} from "@/lib/services/phase-3-actions";
import { FinalizeAttendanceForm } from "@/components/admin/finalize-attendance-form";
import { OpenAttendanceForm } from "@/components/admin/open-attendance-form";
import { ReopenAttendanceForm } from "@/components/admin/reopen-attendance-form";
import { EventRareLifecycleActions } from "@/components/admin/event-rare-lifecycle-actions";
import { EventDeleteLeanForm } from "@/components/admin/event-delete-lean-form";
import { phase7EventUrl } from "@/lib/services/phase-7-actions";
import { normalizePublicSlug } from "@/lib/services/phase-7";
import { EventPublicSharePanel } from "@/components/admin/event-public-share-panel";
import { OccurrenceLocationOverrideForm } from "@/components/admin/occurrence-location-override-form";
import { EventRegistrationPauseControls } from "@/components/admin/event-registration-pause-controls";
import { designAssetPublicUrl } from "@/lib/config/design-assets";
import { calendarEventFromRecord } from "@/lib/services/admin-calendar";
import {
  createEventImageIntent,
  createSeriesImageIntent,
  EVENT_IMAGE_ASSET_TYPE,
} from "@/lib/services/event-image-intent";
import { AdminWorkspaceMenu } from "@/components/admin/admin-workspace-menu";
import { getAdminWorkspaceMenuItems } from "@/components/admin/admin-workspace-menu-items";
import { ProgressiveDisclosureSection } from "@/components/admin/progressive-disclosure-section";
import { RecurrenceScheduleManager } from "@/components/admin/recurrence-schedule-manager";
import { PublicErrorState } from "@/components/registration/public-error-state";
import { reconcileAttendanceOpenForEvent } from "@/lib/services/attendance-auto-open";

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

function localWeekday(value: string, timezone: string) {
  const date = localValue(value, timezone).slice(0, 10);
  return Number(new Date(`${date}T00:00:00Z`).getUTCDay()) || 7;
}

function attendanceLabel(state: string) {
  if (state === "OPEN") return "Check-in open";
  if (state === "REOPENED") return "Check-in reopened";
  if (state === "FINALIZED") return "Attendance finalized";
  return "Check-in not started";
}

function statusLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    OPEN: "Open",
    PUBLISHED: "Published",
    DRAFT: "Draft",
    CANCELLED: "Cancelled",
    COMPLETED: "Completed",
    PAUSED: "Paused",
    PUBLIC: "Public",
    UNLISTED: "Unlisted",
    INVITE_ONLY: "Invite only",
  };
  return value ? (labels[value] ?? value.replaceAll("_", " ")) : "Not specified";
}

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const db = await createClient();
  let { data: event } = await db.from("events").select("*").eq("id", id).single();
  if (
    event &&
    event.status !== "CANCELLED" &&
    event.status !== "DRAFT" &&
    event.attendance_processing_state === "NOT_STARTED"
  ) {
    const reconciled = await reconcileAttendanceOpenForEvent(db, id);
    if (reconciled?.attendance_processing_state) {
      event = { ...event, attendance_processing_state: reconciled.attendance_processing_state };
    }
  }
  if (!event) {
    const admin = await requireActiveAdmin(`/admin/events/${id}`);
    if (admin.role === "HOST_ADMIN") {
      redirect("/admin/access-denied");
    }
    return (
      <PublicErrorState
        code="404"
        title="Event not found."
        message="The requested Event does not exist."
        actionLabel="Return home"
        actionHref="/admin/events"
      />
    );
  }
  const { data: eventSeries } = event.event_series_id
    ? await db
        .from("event_series")
        .select("id,frequency,ends_on,selection_window_days,public_slug")
        .eq("id", event.event_series_id)
        .maybeSingle()
    : { data: null };
  const { data: scheduleRules } = event.event_series_id
    ? await db
        .from("event_series_schedule_rules")
        .select(
          "id,weekday,local_start_time,local_end_time,effective_start_date,effective_end_date,supersedes_rule_id",
        )
        .eq("event_series_id", event.event_series_id)
        .order("effective_start_date", { ascending: true })
        .order("weekday", { ascending: true })
    : { data: [] };
  const { data: seriesOccurrences } = event.event_series_id
    ? await db
        .from("events")
        .select(
          "id,starts_at,status,generated_local_date,schedule_rule_id,registrations(registration_status,registration_outcome)",
        )
        .eq("event_series_id", event.event_series_id)
        .order("starts_at", { ascending: true })
    : { data: [] };
  const admin = await requireOrganizationAccess(event.host_organization_id, `/admin/events/${id}`);
  const [{ data: organizations }, { data: venues }] = await Promise.all([
    db.from("organizations").select("id,name").eq("active_status", "ACTIVE").order("name"),
    db
      .from("venues")
      .select("id,name,organization_id,timezone,street,city,state,postal_code")
      .eq("active_status", "ACTIVE")
      .order("name"),
  ]);
  const { data: eventImage } = await db
    .from("design_assets")
    .select("id,storage_path,alt_text")
    .eq("event_id", id)
    .eq("asset_type", "EVENT_IMAGE_DESKTOP")
    .eq("active", true)
    .maybeSingle();
  // Preview prefers the soonest upcoming non-cancelled occurrence as the series image source.
  // eslint-disable-next-line react-hooks/purity -- server page snapshot uses the request instant
  const nowMs = Date.now();
  const futureSeriesOccurrenceIds = (seriesOccurrences ?? [])
    .filter(
      (occurrence) =>
        occurrence.status !== "CANCELLED" && new Date(occurrence.starts_at).getTime() > nowMs,
    )
    .map((occurrence) => occurrence.id);
  const seriesImageEventId = futureSeriesOccurrenceIds[0] ?? null;
  const { data: seriesMainImage } =
    event.event_series_id && seriesImageEventId
      ? await db
          .from("design_assets")
          .select("id,storage_path,alt_text,event_id")
          .eq("event_id", seriesImageEventId)
          .eq("asset_type", "EVENT_IMAGE_DESKTOP")
          .eq("active", true)
          .maybeSingle()
      : { data: null };
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
  const recurrenceOccurrences = (seriesOccurrences ?? []).map((occurrence) => ({
    id: occurrence.id,
    starts_at: occurrence.starts_at,
    generated_local_date: occurrence.generated_local_date,
    schedule_rule_id: occurrence.schedule_rule_id,
    active_bookings: (
      (occurrence.registrations ?? []) as Array<{
        registration_status: string;
        registration_outcome: string | null;
      }>
    ).filter(
      (registration) =>
        registration.registration_status === "REGISTERED" &&
        registration.registration_outcome === "ACTIVE",
    ).length,
  }));
  const eventVenue = venues?.find(
    (venue) => venue.id === (event.location_override_venue_id ?? event.venue_id),
  );
  const eventCalendarEvent = calendarEventFromRecord(event, eventVenue);
  const registeredCount = (registrations ?? []).filter(
    (registration) => registration.registration_status === "REGISTERED",
  ).length;
  const checkedInCount = (registrations ?? []).filter(
    (registration) =>
      registration.registration_status === "REGISTERED" &&
      attendanceByRegistration.get(registration.id)?.status === "ATTENDED",
  ).length;
  const canonicalSlug = event.public_slug ?? eventSeries?.public_slug ?? null;
  const publicUrl =
    canonicalSlug && event.access_mode !== "INVITE_ONLY"
      ? await phase7EventUrl(canonicalSlug)
      : null;
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
    <>
      <AdminWorkspaceMenu
        roleLabel={admin.role === "SYSTEM_ADMIN" ? "System Admin" : "Host Admin"}
        scopeLabel={
          admin.role === "SYSTEM_ADMIN" ? "All organizations" : admin.organizationNames.join(" · ")
        }
        signOutAction={signOut}
        items={getAdminWorkspaceMenuItems(admin.role === "SYSTEM_ADMIN")}
      />
      <section className="admin-shell admin-manage-event-page">
        <div className="admin-manage-event-shell">
          <ContextualBack
            href={
              from === "organization"
                ? `/admin/organizations/${event.host_organization_id}`
                : "/admin/events"
            }
            label={from === "organization" ? "Organization" : "Events"}
          />
          <div className="admin-page-header admin-manage-event-header">
            <p className="admin-manage-event-kicker">Operations / Manage Event</p>
            <h1>{event.name}</h1>
            <p className="admin-manage-event-subtitle">
              {new Intl.DateTimeFormat("en-US", {
                dateStyle: "full",
                timeStyle: "short",
                timeZone: event.timezone,
              }).format(new Date(event.starts_at))}{" "}
              · {event.timezone}
            </p>
            <dl className="admin-manage-event-identity">
              <div>
                <dt>Status</dt>
                <dd
                  className={event.publication_status === "PUBLISHED" ? "is-positive" : undefined}
                >
                  {statusLabel(event.publication_status)}
                </dd>
              </div>
              <div>
                <dt>Attendance readiness</dt>
                <dd>{attendanceLabel(event.attendance_processing_state)}</dd>
              </div>
            </dl>
          </div>
          <div className="admin-manage-event-summary">
            <div className="admin-manage-event-summary-heading">
              <div>
                <p>Operational summary</p>
                <h2>{attendanceLabel(event.attendance_processing_state)}</h2>
              </div>
            </div>
            <dl className="admin-manage-event-metrics">
              <div>
                <dt>Registrations</dt>
                <dd>
                  {registeredCount} / {event.capacity}
                </dd>
              </div>
              <div>
                <dt>Available spots</dt>
                <dd>{Math.max(0, event.capacity - registeredCount)}</dd>
              </div>
              <div>
                <dt>Attendance</dt>
                <dd>{checkedInCount} checked in</dd>
              </div>
            </dl>
          </div>
          <div className="admin-manage-event-card admin-manage-event-calendar-card">
            <h2>Share and calendar</h2>
            {canEdit ? (
              <EventPublicSharePanel
                eventId={id}
                publicUrl={publicUrl}
                canonicalSlug={canonicalSlug}
                accessMode={event.access_mode ?? "PUBLIC"}
                suggestedSlug={normalizePublicSlug(event.name)}
              />
            ) : (
              <div className="admin-manage-event-calendar-share-actions">
                {publicUrl ? (
                  <a className="admin-manage-event-share-link" href={publicUrl}>
                    Share event <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <p className="admin-manage-event-share-empty">
                    No public registration link is available for this Event yet.
                  </p>
                )}
                {canonicalSlug ? (
                  <a className="admin-manage-event-share-link" href={`/admin/events/${id}/qr`}>
                    QR Code <span aria-hidden="true">↗</span>
                  </a>
                ) : null}
              </div>
            )}
            {event.status !== "CANCELLED" ? (
              <div className="admin-manage-event-calendar-actions">
                <CalendarUtility events={[eventCalendarEvent]} single />
              </div>
            ) : null}
          </div>
          {event.status === "CANCELLED" ? (
            <p className="admin-manage-event-cancelled">
              This event is permanently cancelled and cannot be restored. Copy it to create a
              separate draft.
            </p>
          ) : null}
          {event.status !== "CANCELLED" &&
          event.status !== "DRAFT" &&
          event.attendance_processing_state === "NOT_STARTED" ? (
            <OpenAttendanceForm eventId={id} />
          ) : null}
          {event.status !== "CANCELLED" &&
          event.status !== "DRAFT" &&
          event.attendance_processing_state === "FINALIZED" &&
          admin.role === "SYSTEM_ADMIN" ? (
            <ReopenAttendanceForm eventId={id} />
          ) : null}
          {event.status !== "CANCELLED" && event.attendance_processing_state === "OPEN" ? (
            admin.role === "SYSTEM_ADMIN" ? (
              <FinalizeAttendanceForm eventId={id} />
            ) : null
          ) : null}
          {event.status !== "CANCELLED" && event.attendance_processing_state === "OPEN" ? (
            <ProgressiveDisclosureSection id="manage-event-walk-in" number="08" title="Add walk-in">
              <div className="admin-manage-event-walkin">
                <p className="text-sm text-slate-600">
                  A walk-in is matched or created, registered, and checked in atomically.
                </p>
                <WalkInForm
                  eventId={id}
                  participationVersionId={participationVersion?.id ?? ""}
                  dataUseVersionId={dataUseVersion?.id ?? ""}
                  showOverrideReason={
                    admin.role === "SYSTEM_ADMIN" && registeredCount >= event.capacity
                  }
                />
              </div>
            </ProgressiveDisclosureSection>
          ) : null}
          <section
            id="manage-event-configuration"
            className="admin-manage-event-configuration-shell"
          >
            <h2 className="sr-only">Admin</h2>
            <div className="admin-manage-event-configuration">
              {canEdit ? (
                <>
                  <ProgressiveDisclosureSection
                    id="manage-event-basics"
                    number="01"
                    title="Event basics"
                  >
                    <div className="admin-event-update-form grid gap-4">
                      <input form="manage-event-update" type="hidden" name="id" value={id} />
                      <label>
                        Name
                        <input
                          form="manage-event-update"
                          name="name"
                          required
                          defaultValue={event.name}
                          className="mt-1 w-full rounded border p-2"
                        />
                      </label>
                      <EventTitleOverlayControl
                        form="manage-event-update"
                        eventName={event.name}
                        imageUrl={
                          eventImage ? designAssetPublicUrl(eventImage.storage_path) : undefined
                        }
                        initialColor={event.event_title_color ?? "#FFFFFF"}
                      />
                      <OrganizationVenueFields
                        form="manage-event-update"
                        organizations={organizations ?? []}
                        venues={venues ?? []}
                        organizationId={event.host_organization_id}
                        venueId={event.venue_id}
                      />
                      <label>
                        Capacity
                        <input
                          form="manage-event-update"
                          name="capacity"
                          type="number"
                          min="1"
                          required
                          defaultValue={event.capacity}
                          className="mt-1 w-full rounded border p-2"
                        />
                      </label>
                      {admin.role === "SYSTEM_ADMIN" ? (
                        <OccurrenceLocationOverrideForm
                          eventId={id}
                          organizationId={event.host_organization_id}
                          organizationName={
                            organizations?.find(
                              (organization) => organization.id === event.host_organization_id,
                            )?.name
                          }
                          defaultVenueId={event.location_override_venue_id ?? event.venue_id}
                          venues={venues ?? []}
                        />
                      ) : null}
                    </div>
                  </ProgressiveDisclosureSection>
                  <ActionForm
                    id="manage-event-update"
                    action={updateEvent}
                    submitLabel="Update"
                    className="admin-event-update-form"
                    successClassName="admin-manage-event-update-success"
                    successCheckmark
                  >
                    <ProgressiveDisclosureSection
                      id="manage-event-schedule"
                      className="admin-manage-event-schedule-section"
                      number="02"
                      title="Schedule"
                    >
                      {eventSeries ? (
                        <div className="admin-manage-event-occurrence-context" role="note">
                          <strong>Manage This Occurrence</strong>
                          <p>
                            Changes here affect only this date. They do not change the recurring
                            schedule.
                          </p>
                        </div>
                      ) : null}
                      <EventTimingFields
                        startValue={localValue(event.starts_at, event.timezone)}
                        endValue={localValue(event.ends_at, event.timezone)}
                        deadlineValue={localValue(event.registration_deadline, event.timezone)}
                      />
                    </ProgressiveDisclosureSection>
                    <ProgressiveDisclosureSection
                      id="manage-event-repeat"
                      number="03"
                      title="Series"
                    >
                      {eventSeries ? (
                        <>
                          <RecurrenceScheduleManager
                            seriesId={eventSeries.id}
                            seriesEndsOn={eventSeries.ends_on}
                            timezone={event.timezone}
                            initialWeekday={localWeekday(event.starts_at, event.timezone)}
                            initialStart={localValue(event.starts_at, event.timezone).slice(11, 16)}
                            initialEnd={localValue(event.ends_at, event.timezone).slice(11, 16)}
                            initialEffectiveDate={localValue(event.starts_at, event.timezone).slice(
                              0,
                              10,
                            )}
                            rules={(scheduleRules ?? []).map((rule) => ({
                              ...rule,
                              local_start_time: String(rule.local_start_time),
                              local_end_time: String(rule.local_end_time),
                            }))}
                            occurrences={recurrenceOccurrences}
                            canMutate={
                              admin.role === "SYSTEM_ADMIN" &&
                              event.status !== "CANCELLED" &&
                              event.status !== "COMPLETED"
                            }
                          />
                          {admin.role === "SYSTEM_ADMIN" ? (
                            <div className="admin-manage-event-image admin-series-main-image mt-6">
                              <h3 className="font-semibold">Series image</h3>
                              <p className="mt-1 text-sm text-slate-600">
                                Updates the main image on future non-cancelled dates. Past dates
                                keep their current image. This occurrence-only control remains under
                                Event image.
                              </p>
                              {seriesMainImage ? (
                                <img
                                  src={designAssetPublicUrl(seriesMainImage.storage_path)}
                                  alt={seriesMainImage.alt_text}
                                  className="mt-4 aspect-video w-full rounded-xl object-cover"
                                />
                              ) : (
                                <p className="mt-3 rounded border border-dashed p-4 text-sm text-slate-600">
                                  No series image on upcoming dates yet.
                                </p>
                              )}
                              <SeriesMainImageForm
                                seriesId={eventSeries.id}
                                intentToken={createSeriesImageIntent(
                                  eventSeries.id,
                                  admin.userId,
                                  EVENT_IMAGE_ASSET_TYPE,
                                )}
                                defaultAltText={`${event.name} series image`}
                              />
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <p className="admin-create-guidance">This is a single Event.</p>
                      )}
                    </ProgressiveDisclosureSection>
                    <ProgressiveDisclosureSection
                      id="manage-event-visibility"
                      number="04"
                      title="Visibility and access"
                    >
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
                        Who can access this Event?
                        <select
                          name="accessMode"
                          defaultValue={event.access_mode ?? "PUBLIC"}
                          className="mt-1 w-full rounded border p-2"
                        >
                          <option value="PUBLIC">Public — visible on the public Events page</option>
                          <option value="UNLISTED">Unlisted — anyone with the direct link</option>
                          <option value="INVITE_ONLY">
                            Invite-only — a valid invitation link is required
                          </option>
                        </select>
                        <span className="mt-1 block text-xs text-slate-500">
                          Unlisted and invite-only Events stay hidden from public discovery.
                        </span>
                      </label>
                    </ProgressiveDisclosureSection>
                    <ProgressiveDisclosureSection
                      id="manage-event-participant-information"
                      number="05"
                      title="Participant information"
                    >
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
                          Use one plain-text item per line. These notes appear on the public event
                          and booking confirmation.
                        </span>
                      </label>
                    </ProgressiveDisclosureSection>
                    <ProgressiveDisclosureSection
                      id="manage-event-communications"
                      number="06"
                      title="Communication"
                    >
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
                    </ProgressiveDisclosureSection>
                  </ActionForm>
                </>
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
          </section>
          {admin.role === "SYSTEM_ADMIN" && canEdit ? (
            <ProgressiveDisclosureSection id="manage-event-image" number="07" title="Event image">
              <div className="admin-manage-event-image">
                {eventImage ? (
                  <img
                    src={designAssetPublicUrl(eventImage.storage_path)}
                    alt={eventImage.alt_text}
                    className="mt-4 aspect-video w-full rounded-xl object-cover"
                  />
                ) : (
                  <p className="mt-3 rounded border border-dashed p-4 text-sm text-slate-600">
                    No image associated with this event.
                  </p>
                )}
                <DesignAssetUploadForm
                  events={[{ id, name: event.name }]}
                  eventOnly
                  eventId={id}
                  intentToken={createEventImageIntent(id, admin.userId, EVENT_IMAGE_ASSET_TYPE)}
                  defaultAltText={`${event.name} event image`}
                />
              </div>
            </ProgressiveDisclosureSection>
          ) : null}
          <RosterPreview
            eventId={id}
            eventName={event.name}
            people={(registrations ?? []).map((registration) => {
              const participant = participantById.get(registration.participant_id);
              return {
                id: registration.participant_id,
                name: participant
                  ? `${participant.first_name} ${participant.last_name}`
                  : "Participant unavailable",
                phone: participant?.display_phone ?? null,
                attendanceStatus:
                  attendanceByRegistration.get(registration.id)?.status ?? "NOT_RECORDED",
                attendanceState: event.attendance_processing_state,
                firstClass: Boolean(participant && !firstClassParticipantIds.has(participant.id)),
              };
            })}
            canViewPhone={true}
          />
          <ProgressiveDisclosureSection
            id="manage-event-publication"
            number="09"
            title="Publication and links"
          >
            <dl className="admin-manage-event-details-list">
              <div>
                <dt className="text-slate-500">Registration</dt>
                <dd>{event.registration_paused_at ? "Paused" : "Open"}</dd>
              </div>
            </dl>
            {admin.role === "SYSTEM_ADMIN" && event.status !== "CANCELLED" ? (
              <EventRegistrationPauseControls
                eventId={id}
                paused={Boolean(event.registration_paused_at)}
              />
            ) : null}
            {event.access_mode === "INVITE_ONLY" && canEdit ? (
              <div className="admin-manage-event-invite">
                <h3 className="font-semibold">Reusable invite link</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Generate a server-created link for intended participants. The token is bound to
                  this Event.
                </p>
                <ActionForm
                  action={generateEventInviteLink}
                  submitLabel="Generate invite link"
                  className="mt-3"
                >
                  <input type="hidden" name="eventId" value={id} />
                </ActionForm>
                <form action={revokeEventInviteLinksForm} className="mt-3">
                  <input type="hidden" name="eventId" value={id} />
                  <button type="submit" className="text-sm text-red-700 underline">
                    Revoke active invite links
                  </button>
                </form>
              </div>
            ) : null}
            <p className="admin-manage-event-share-empty">
              Public slug, Share link, and QR live in Share and calendar above.
            </p>
          </ProgressiveDisclosureSection>
          {admin.role === "SYSTEM_ADMIN" ? (
            <div className="admin-manage-event-rare-actions">
              <EventRareLifecycleActions
                eventId={id}
                status={event.status}
                archivedAt={event.archived_at}
              />
              <EventDeleteLeanForm eventId={id} />
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
