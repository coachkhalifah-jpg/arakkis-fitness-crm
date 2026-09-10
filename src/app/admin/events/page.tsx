import { requireActiveAdmin } from "@/lib/authorization/server";
import { signOut } from "@/lib/auth/session-actions";
import { createClient } from "@/lib/db/server";
import { createEvent, markAttendanceSubmit } from "@/lib/services/phase-3-actions";
import { removeRegistrationFromRoster } from "@/lib/services/phase-5-actions";
import { SegmentedNavigation } from "@/components/admin/segmented-navigation";
import {
  AdminEventsDiscovery,
  type AdminDiscoveryEvent,
} from "@/components/admin/admin-events-discovery";
import { eventCardAsset } from "@/lib/config/admin-visual-assets";
import { designAssetPublicUrl } from "@/lib/config/design-assets";
import { ActionForm } from "@/components/admin/action-form";
import { randomUUID } from "node:crypto";
import { OrganizationVenueFields, EventTimingFields } from "@/components/admin/event-form-fields";
import { RecurringScheduleFields } from "@/components/admin/recurring-schedule-fields";
import { AdminWorkspaceMenu } from "@/components/admin/admin-workspace-menu";
import { getAdminWorkspaceMenuItems } from "@/components/admin/admin-workspace-menu-items";
import { ProgressiveDisclosureSection } from "@/components/admin/progressive-disclosure-section";
import { CalendarUtility } from "@/components/admin/calendar-utility";
import { getAuthorizedCalendarEvents } from "@/lib/services/admin-calendar";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; event?: string }>;
}) {
  const admin = await requireActiveAdmin();
  const calendarEvents = await getAuthorizedCalendarEvents(admin);
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
        "id,name,event_title_color,status,publication_status,public_slug,starts_at,ends_at,timezone,capacity,registration_deadline,host_organization_id,venue_id,event_series_id,attendance_processing_state,event_series(public_slug)",
      )
      .order("starts_at", { ascending: true }),
  ]);
  const visibleEvents =
    admin.role === "SYSTEM_ADMIN"
      ? events
      : (events ?? []).filter((event) =>
          admin.organizationIds.includes(event.host_organization_id),
        );
  visibleEvents?.sort((a, b) => {
    // Server-rendered ordering intentionally uses the current instant so future events lead.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const aFuture = Date.parse(a.starts_at) >= now;
    const bFuture = Date.parse(b.starts_at) >= now;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    return Date.parse(a.starts_at) - Date.parse(b.starts_at);
  });
  const params = await searchParams;
  const mode = params.mode === "create" ? "create" : "list";
  const initialEventId =
    params.event && visibleEvents?.some((event) => event.id === params.event) ? params.event : null;
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
        .select("event_id,storage_path,focal_position")
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
  const eventImageFocalById = new Map(
    (eventImageAssets ?? []).map((asset) => [asset.event_id, asset.focal_position ?? "center"]),
  );
  const { data: rosterRows } = eventIds.length
    ? await db
        .from("registrations")
        .select(
          "id,event_id,participant_id,registration_status,participants(id,first_name,last_name,display_phone,email),attendance(status)",
        )
        .in("event_id", eventIds)
    : { data: [] };
  const rosterByEvent = new Map<
    string,
    Array<{
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
      registrationStatus: string;
      attendanceStatus: string;
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
      email: participant.email ?? null,
      registrationStatus: row.registration_status,
      attendanceStatus: attendance?.status ?? "NOT_RECORDED",
      firstClass: !priorStarts.some((start) => start < currentStart),
    });
    rosterByEvent.set(row.event_id, people);
  }
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
      <section
        className={`admin-shell admin-events-page ${mode === "create" ? "admin-create-event-page" : ""}`}
      >
        <div className="admin-events-page-shell">
          <div className="admin-events-head">
            <div className="admin-page-header">
              <p className="admin-events-kicker">
                {mode === "create" ? "System Admin / Create Event" : "Operations / Events"}
              </p>
              <h1>
                {mode === "create" ? (
                  <>
                    <span>Make room</span>
                    <em>for people.</em>
                  </>
                ) : (
                  <>
                    <span>Find the</span>
                    <em>right room.</em>
                  </>
                )}
              </h1>
              {mode === "create" ? (
                <p className="admin-events-subtext">
                  Create a draft for internal review or publish a public event.
                </p>
              ) : null}
              <SegmentedNavigation
                listLabel="Events"
                actionLabel="Create"
                actionHref="/admin/events?mode=create"
                actionIcon="+"
                className="admin-events-mode-nav"
              />
            </div>
            {mode !== "create" ? (
              <div className="admin-events-scope-block">
                <span>Current scope</span>
                <strong>
                  {admin.role === "SYSTEM_ADMIN"
                    ? "All organizations"
                    : admin.organizationNames.join(" · ")}
                </strong>
                <span>Upcoming events are prioritized</span>
              </div>
            ) : null}
          </div>
          {admin.role === "SYSTEM_ADMIN" && mode === "create" ? (
            <ActionForm
              action={createEvent}
              focusFirstError
              submitOptions={[
                { label: "Create Draft", value: "draft" },
                { label: "Publish Event", value: "publish" },
              ]}
              className="admin-create-event-form"
            >
              <input type="hidden" name="creationRequestId" value={randomUUID()} />
              <ProgressiveDisclosureSection
                id="event-basics"
                number="01"
                title="Event basics"
                defaultOpen
                errorKeywords={["organization", "venue", "capacity", "name"]}
              >
                <label>
                  Name
                  <input name="name" required className="mt-1 w-full rounded border p-2" />
                </label>
                <OrganizationVenueFields
                  organizations={organizations ?? []}
                  venues={venues ?? []}
                />
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
              </ProgressiveDisclosureSection>
              <ProgressiveDisclosureSection
                id="event-schedule"
                number="02"
                title="Schedule"
                defaultOpen
                errorKeywords={["time", "deadline", "timezone", "start", "end"]}
              >
                <EventTimingFields
                  venueTimezones={Object.fromEntries(
                    (venues ?? []).map((venue) => [venue.id, venue.timezone]),
                  )}
                />
                <p className="admin-create-guidance">
                  Times are entered in the selected venue’s local timezone. Registration closes at
                  or before the event start.
                </p>
              </ProgressiveDisclosureSection>
              <ProgressiveDisclosureSection
                id="event-repeat"
                number="03"
                title="Series"
                autoOpenOnField="recurring"
                errorKeywords={["recurr", "weekly"]}
              >
                <label className="admin-create-checkbox-label">
                  <input name="recurring" type="checkbox" className="h-5 w-5 accent-brand" />
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
                  End date
                  <input
                    name="recurrenceEndsOn"
                    type="date"
                    className="mt-1 w-full rounded border bg-white p-2"
                    aria-describedby="recurrence-help"
                  />
                </label>
                <RecurringScheduleFields />
                <p id="recurrence-help" className="admin-create-guidance">
                  Weekly dates are created through this end date. Participants can select dates only
                  within the next 14 days from the series link.
                </p>
              </ProgressiveDisclosureSection>
              <ProgressiveDisclosureSection
                id="event-access"
                number="04"
                title="Visibility and access"
                errorKeywords={["access", "visibility", "invite", "public"]}
              >
                <label>
                  Visibility
                  <select name="visibility" className="mt-1 w-full rounded border p-2">
                    <option value="PUBLIC">Public</option>
                    <option value="AFFILIATION_RESTRICTED">Affiliation restricted</option>
                  </select>
                </label>
                <label>
                  Who can access this Event?
                  <select
                    name="accessMode"
                    defaultValue="PUBLIC"
                    className="mt-1 w-full rounded border p-2"
                  >
                    <option value="PUBLIC">Public — visible on the public Events page</option>
                    <option value="UNLISTED">Unlisted — anyone with the direct link</option>
                    <option value="INVITE_ONLY">
                      Invite-only — a valid invitation link is required
                    </option>
                  </select>
                </label>
                <p className="admin-create-guidance">
                  Visibility controls who sees the Event. Access mode controls whether a public
                  listing, direct link, or invitation is required.
                </p>
              </ProgressiveDisclosureSection>
              <ProgressiveDisclosureSection
                id="event-participant-info"
                number="05"
                title="Participant information"
                errorKeywords={["description", "bring", "arrival", "participant"]}
              >
                <label>
                  Description
                  <textarea
                    name="description"
                    className="mt-1 min-h-20 w-full rounded border p-2"
                  />
                </label>
                <label>
                  What to bring and arrival notes
                  <textarea
                    name="participantInstructions"
                    className="mt-1 min-h-20 w-full rounded border p-2"
                    aria-describedby="participant-instructions-help"
                  />
                  <span id="participant-instructions-help" className="admin-create-guidance">
                    Use one plain-text item per line. These notes appear on the public event and
                    booking confirmation.
                  </span>
                </label>
              </ProgressiveDisclosureSection>
              <ProgressiveDisclosureSection
                id="event-communications"
                number="06"
                title="Communications"
                errorKeywords={["communication", "https"]}
              >
                <label>
                  Communication link
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
              </ProgressiveDisclosureSection>
              <ProgressiveDisclosureSection
                id="event-image"
                number="07"
                title="Event image"
                errorKeywords={["image", "jpeg", "png", "webp", "svg", "5 mib"]}
              >
                <label>
                  Event card image
                  <input
                    name="eventImage"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    className="mt-1 block w-full rounded border border-dashed p-3"
                  />
                  <span className="admin-create-guidance">
                    JPEG, PNG, WebP, or SVG up to 5 MiB. The existing preview and validation rules
                    apply.
                  </span>
                </label>
              </ProgressiveDisclosureSection>
            </ActionForm>
          ) : null}
          {mode === "list" ? (
            <AdminEventsDiscovery
              events={(visibleEvents ?? []).map((event): AdminDiscoveryEvent => {
                const venue = venues?.find((item) => item.id === event.venue_id);
                const count = counts.get(event.id) ?? { booked: 0, checkedIn: 0 };
                const people = rosterByEvent.get(event.id) ?? [];
                const dateParts = new Intl.DateTimeFormat("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  timeZone: event.timezone,
                }).formatToParts(new Date(event.starts_at));
                return {
                  id: event.id,
                  name: event.name,
                  organizationId: event.host_organization_id,
                  organizationName:
                    organizations?.find((item) => item.id === event.host_organization_id)?.name ??
                    "Organization",
                  status: event.status,
                  publicationStatus: event.publication_status,
                  startsAt: event.starts_at,
                  event: {
                    id: event.id,
                    name: event.name,
                    eventTitleColor: event.event_title_color,
                    status: event.status,
                    publicationStatus: event.publication_status,
                    capacity: event.capacity,
                    eventSeriesId: event.event_series_id,
                    attendanceState: event.attendance_processing_state,
                  },
                  venueName: venue?.name ?? "Venue",
                  date: {
                    weekday: dateParts.find((part) => part.type === "weekday")?.value ?? "",
                    day: dateParts.find((part) => part.type === "day")?.value ?? "",
                    month: dateParts.find((part) => part.type === "month")?.value ?? "",
                  },
                  timeLabel: new Intl.DateTimeFormat("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: event.timezone,
                  }).format(new Date(event.starts_at)),
                  durationMinutes: Math.max(
                    0,
                    Math.round(
                      (new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()) /
                        60000,
                    ),
                  ),
                  image: eventImageById.get(event.id) ?? eventCardAsset(event.name),
                  focalPosition: eventImageFocalById.get(event.id) ?? "center",
                  count,
                  firstClassCount: people.filter((person) => person.firstClass).length,
                  people,
                  canViewPhone: true,
                  canCheckIn:
                    event.status !== "CANCELLED" &&
                    (event.attendance_processing_state === "OPEN" ||
                      event.attendance_processing_state === "REOPENED"),
                  checkInAction: markAttendanceSubmit,
                  removeRegistrationAction: removeRegistrationFromRoster,
                  canRemoveRegistration:
                    event.status !== "CANCELLED" &&
                    event.attendance_processing_state !== "FINALIZED",
                };
              })}
              calendarEvents={calendarEvents ?? []}
              calendarError={calendarEvents === null}
              initialEventId={initialEventId}
            />
          ) : null}
        </div>
      </section>
    </>
  );
}
