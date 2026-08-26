import { signOut } from "@/lib/auth/session-actions";
import { requireActiveAdmin } from "@/lib/authorization/server";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { eventCardAsset } from "@/lib/config/admin-visual-assets";
import { AdminWorkspaceMenu } from "@/components/admin/admin-workspace-menu";
import { getAdminWorkspaceMenuItems } from "@/components/admin/admin-workspace-menu-items";
import { CalendarUtility } from "@/components/admin/calendar-utility";
import { getAuthorizedCalendarEvents } from "@/lib/services/admin-calendar";
import { PublicErrorState } from "@/components/registration/public-error-state";

type WorkspaceEvent = {
  id: string;
  name: string;
  status: string;
  publication_status: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  capacity: number;
  host_organization_id: string;
  venue_id: string | null;
};

type HostWorkspaceData = {
  events: WorkspaceEvent[];
  organizationNames: Map<string, string>;
  venueNames: Map<string, string>;
  registrations: Map<string, number>;
};

async function getWorkspaceData(admin: Awaited<ReturnType<typeof requireActiveAdmin>>) {
  const db = await createClient();
  const now = new Date().toISOString();
  const eventResult =
    admin.role === "SYSTEM_ADMIN"
      ? await db
          .from("events")
          .select(
            "id,name,status,publication_status,starts_at,ends_at,timezone,capacity,host_organization_id,venue_id",
          )
          .gte("starts_at", now)
          .neq("status", "CANCELLED")
          .order("starts_at", { ascending: true })
          .limit(20)
      : await db
          .from("events")
          .select(
            "id,name,status,publication_status,starts_at,ends_at,timezone,capacity,host_organization_id,venue_id",
          )
          .in("host_organization_id", admin.organizationIds)
          .gte("starts_at", now)
          .neq("status", "CANCELLED")
          .order("starts_at", { ascending: true })
          .limit(20);
  const { data: eventRows, error: eventError } = eventResult;
  if (eventError) return null;

  const events = (eventRows ?? []) as WorkspaceEvent[];
  const organizationIds = [...new Set(events.map((event) => event.host_organization_id))];
  const venueIds = [
    ...new Set(events.flatMap((event) => (event.venue_id ? [event.venue_id] : []))),
  ];
  const [{ data: organizations, error: organizationError }, { data: venues, error: venueError }] =
    await Promise.all([
      organizationIds.length
        ? db.from("organizations").select("id,name").in("id", organizationIds)
        : Promise.resolve({ data: [], error: null }),
      venueIds.length
        ? db.from("venues").select("id,name").in("id", venueIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (organizationError || venueError) return null;

  const { data: registrationRows, error: registrationError } = events.length
    ? await db
        .from("registrations")
        .select("event_id,registration_status")
        .in(
          "event_id",
          events.map((event) => event.id),
        )
        .eq("registration_status", "REGISTERED")
    : { data: [], error: null };
  if (registrationError) return null;

  return {
    events,
    organizationNames: new Map(
      (organizations ?? []).map((organization) => [organization.id, organization.name]),
    ),
    venueNames: new Map((venues ?? []).map((venue) => [venue.id, venue.name])),
    registrations: (registrationRows ?? []).reduce((counts, row) => {
      counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()),
  } satisfies HostWorkspaceData;
}

function formatEventDate(event: WorkspaceEvent) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: event.timezone,
  }).format(new Date(event.starts_at));
}

function formatEventTime(event: WorkspaceEvent) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: event.timezone,
  });
  return `${formatter.format(new Date(event.starts_at))}–${formatter.format(new Date(event.ends_at))}`;
}

function eventStatusLabel(event: WorkspaceEvent, booked: number) {
  if (event.status === "DRAFT") return "Draft";
  if (event.publication_status !== "PUBLISHED") return "Unpublished";
  if (booked >= event.capacity) return "Full";
  return event.status === "OPEN" ? "Open" : event.status;
}

function HostWorkspace({
  admin,
  data,
  calendarEvents,
}: {
  admin: Awaited<ReturnType<typeof requireActiveAdmin>>;
  data: HostWorkspaceData;
  calendarEvents: Awaited<ReturnType<typeof getAuthorizedCalendarEvents>>;
}) {
  const [nextEvent, ...otherEvents] = data.events;
  const previewEvents = otherEvents.slice(0, 3);
  const isSystemAdmin = admin.role === "SYSTEM_ADMIN";
  const roleLabel = isSystemAdmin ? "System Admin" : "Host Admin";
  const scopeLabel = isSystemAdmin ? "All organizations" : admin.organizationNames.join(" · ");
  const renderEvent = (event: WorkspaceEvent, priority = false) => {
    const booked = data.registrations.get(event.id) ?? 0;
    const venueName = event.venue_id ? data.venueNames.get(event.venue_id) : null;
    const organizationName = data.organizationNames.get(event.host_organization_id);
    const status = eventStatusLabel(event, booked);
    if (priority) {
      return (
        <div
          className="ops-priority-card"
          key={event.id}
          style={{
            backgroundImage: `linear-gradient(180deg, rgb(17 19 21 / .18), rgb(17 19 21 / .94)), url(${eventCardAsset(event.name)})`,
          }}
        >
          <Link
            href={`/admin/events?event=${event.id}`}
            className="ops-priority-card-hit-area"
            aria-label={`Open roster for ${event.name}`}
          >
            <div className="ops-priority-card-content">
              <div className="ops-priority-card-heading">
                <p className="ops-priority-status">
                  {status} / Attendance {booked} / {event.capacity}
                </p>
                <h2>{event.name}</h2>
              </div>
            </div>
          </Link>
          <Link href={`/admin/events/${event.id}`} className="button ops-priority-manage-link">
            <span>Manage event</span>
            <span className="ops-action-arrow" aria-hidden="true">
              ↗
            </span>
          </Link>
        </div>
      );
    }

    return (
      <Link className="ops-event-row" href={`/admin/events/${event.id}`} key={event.id}>
        <span className="ops-event-date ops-meta">{formatEventDate(event)}</span>
        <span className="ops-event-details">
          <h2>{event.name}</h2>
          <span className="ops-event-time ops-meta">{formatEventTime(event)}</span>
        </span>
        <span className="ops-event-org ops-meta">
          {organizationName ?? "Assigned organization"}
          <br />
          {venueName ?? "Venue not assigned"}
        </span>
        <span className="ops-event-capacity ops-status">
          {status}
          <br />
          {booked} / {event.capacity}
        </span>
        <span className="ops-event-arrow ops-action-arrow" aria-hidden="true">
          ↗
        </span>
      </Link>
    );
  };

  return (
    <>
      <AdminWorkspaceMenu
        roleLabel={roleLabel}
        scopeLabel={scopeLabel}
        signOutAction={signOut}
        items={getAdminWorkspaceMenuItems(isSystemAdmin)}
      />
      <main className="page ops-page ops-admin-page">
        <div className="ops-admin-content">
          <header className="ops-head">
            <div>
              <p className="ops-kicker orange">Operations / Workspace</p>
              <h1>
                Good morning,
                <br />
                <em>{admin.displayName}.</em>
              </h1>
            </div>
          </header>
          {nextEvent ? (
            <section className="ops-priority" aria-label="Next operational priority">
              <div className="ops-priority-main">
                <p className="ops-kicker orange">Next operational priority</p>
                {renderEvent(nextEvent, true)}
              </div>
              <div className="ops-summary">
                <div className="ops-summary-row">
                  <span>Date / local time</span>
                  <strong>
                    {formatEventDate(nextEvent)}
                    <br />
                    {formatEventTime(nextEvent)}
                  </strong>
                </div>
                <div className="ops-summary-row">
                  <span>Organization / venue</span>
                  <strong>
                    {organizationNameFor(data, nextEvent)}
                    <br />
                    {venueNameFor(data, nextEvent)}
                  </strong>
                </div>
                <div className="ops-summary-row">
                  <span>Member registrations</span>
                  <strong className="ops-status">
                    {data.registrations.get(nextEvent.id) ?? 0} / {nextEvent.capacity}
                  </strong>
                </div>
                <div className="ops-summary-row">
                  <span>Attendance readiness</span>
                  <strong>
                    {eventStatusLabel(nextEvent, data.registrations.get(nextEvent.id) ?? 0)}
                  </strong>
                </div>
              </div>
            </section>
          ) : (
            <section className="ops-empty ops-section" aria-labelledby="host-empty-title">
              <p className="ops-kicker orange">Operational horizon</p>
              <strong id="host-empty-title">No upcoming events</strong>
              <p>
                When an authorized Event is upcoming, its readiness and next action will appear
                here.
              </p>
              <Link className="button" href="/admin/events">
                View all events{" "}
                <span className="ops-action-arrow" aria-hidden="true">
                  ↗
                </span>
              </Link>
            </section>
          )}
          <section className="ops-section" aria-labelledby="host-upcoming-events">
            <div className="ops-section-head">
              <span className="ops-kicker" id="host-upcoming-events">
                Additional upcoming events
              </span>
              <div className="ops-section-actions">
                <CalendarUtility events={calendarEvents ?? []} error={calendarEvents === null} />
                <Link className="text-link" href="/admin/events">
                  View all
                </Link>
              </div>
            </div>
            {previewEvents.length ? (
              <ul className="ops-event-list">
                {previewEvents.map((event) => (
                  <li key={event.id}>{renderEvent(event)}</li>
                ))}
              </ul>
            ) : (
              <p className="ops-scope-note">No other upcoming Events in your assigned scope.</p>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function organizationNameFor(data: HostWorkspaceData, event: WorkspaceEvent) {
  return data.organizationNames.get(event.host_organization_id) ?? "Assigned organization";
}

function venueNameFor(data: HostWorkspaceData, event: WorkspaceEvent) {
  return event.venue_id
    ? (data.venueNames.get(event.venue_id) ?? "Venue not assigned")
    : "Venue not assigned";
}

export default async function AdminPage() {
  const admin = await requireActiveAdmin();
  if (admin.role === "HOST_ADMIN" || admin.role === "SYSTEM_ADMIN") {
    const [workspaceData, calendarEvents] = await Promise.all([
      getWorkspaceData(admin),
      getAuthorizedCalendarEvents(admin),
    ]);
    if (workspaceData)
      return <HostWorkspace admin={admin} data={workspaceData} calendarEvents={calendarEvents} />;
    return (
      <PublicErrorState
        code="503"
        title="Workspace unavailable."
        message="Authorized workspace data could not be loaded. Please try again without changing your access scope."
        actionLabel="Try again"
        actionHref="/admin"
      />
    );
  }
  return null;
}
