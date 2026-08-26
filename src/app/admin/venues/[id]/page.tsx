import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveAdmin, requireOrganizationAccess } from "@/lib/authorization/server";
import { signOut } from "@/lib/auth/session-actions";
import { createClient } from "@/lib/db/server";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { ActionForm } from "@/components/admin/action-form";
import { AdminWorkspaceMenu } from "@/components/admin/admin-workspace-menu";
import { getAdminWorkspaceMenuItems } from "@/components/admin/admin-workspace-menu-items";
import { archiveVenue, updateVenueState } from "@/lib/services/phase-3-actions";
import { ContextualBack } from "@/components/admin/contextual-back";
import { ProgressiveDisclosureSection } from "@/components/admin/progressive-disclosure-section";
import { PublicErrorState } from "@/components/registration/public-error-state";

export default async function VenueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const db = await createClient();
  const { data: venue } = await db.from("venues").select("*").eq("id", id).single();
  if (!venue) {
    const admin = await requireActiveAdmin(`/admin/venues/${id}`);
    if (admin.role === "HOST_ADMIN") redirect("/admin/access-denied");
    return (
      <PublicErrorState
        code="404"
        title="Venue not found."
        message="The requested Venue does not exist."
        actionLabel="Return to venues"
        actionHref="/admin/venues"
      />
    );
  }
  const admin = await requireActiveAdmin(`/admin/venues/${id}`);
  if (venue.organization_id === null && admin.role !== "SYSTEM_ADMIN") {
    redirect("/admin/access-denied");
  }
  if (venue.organization_id !== null) {
    await requireOrganizationAccess(venue.organization_id, `/admin/venues/${id}`);
  }
  const [{ data: organization }, { data: organizations }, { data: events }] = await Promise.all([
    db
      .from("organizations")
      .select("id,name,organization_type,active_status")
      .eq("id", venue.organization_id)
      .single(),
    db.from("organizations").select("id,name").eq("active_status", "ACTIVE").order("name"),
    db
      .from("events")
      .select("id,name,status,starts_at,timezone,capacity")
      .eq("venue_id", id)
      .order("starts_at"),
  ]);
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const upcomingEvents = (events ?? []).filter(
    (event) => Date.parse(event.starts_at) >= now && event.status !== "CANCELLED",
  );
  const roleLabel = admin.role === "SYSTEM_ADMIN" ? "System Admin" : "Host Admin";
  const scopeLabel =
    admin.role === "SYSTEM_ADMIN" ? "All organizations" : admin.organizationNames.join(" · ");
  const backHref =
    from === "organization" && venue.organization_id
      ? `/admin/organizations/${venue.organization_id}`
      : venue.organization_id === null
        ? "/admin/venues?section=public"
        : "/admin/venues";
  const venueDirectoryHref =
    venue.organization_id === null
      ? "/admin/venues?section=public"
      : `/admin/venues?organization=${venue.organization_id}`;
  const backLabel = from === "organization" && venue.organization_id ? "Organization" : "Venues";

  return (
    <>
      <AdminWorkspaceMenu
        roleLabel={roleLabel}
        scopeLabel={scopeLabel}
        signOutAction={signOut}
        items={getAdminWorkspaceMenuItems(admin.role === "SYSTEM_ADMIN")}
      />
      <main className="ops-page ops-org-page ops-venue-page ops-venue-detail-page">
        <ContextualBack href={backHref} label={backLabel} />
        <div className="ops-head ops-venue-page-head">
          <div>
            <p className="ops-kicker orange">{roleLabel} / Venue</p>
            <h1>{venue.name}</h1>
          </div>
          <div className="ops-context">
            <span className="ops-label">Current scope</span>
            <strong>{organization?.name ?? "Organization unavailable"}</strong>
            <span className="ops-label">
              {venue.timezone} · {venue.active_status}
            </span>
          </div>
        </div>
        <section className="ops-venue-detail-layout">
          <section className="ops-org-detail">
            <div className="ops-org-detail-head">
              <div>
                <p className="ops-kicker orange">Venue identity</p>
                <h2>{venue.name}</h2>
                <p>
                  {venue.street}, {venue.city}, {venue.state} {venue.postal_code}
                </p>
              </div>
              <span className="ops-status">
                {venue.active_status === "ACTIVE" ? "Active" : venue.active_status}
              </span>
            </div>
            <div className="ops-org-stats">
              <div>
                <span className="ops-label">Timezone</span>
                <strong>{venue.timezone}</strong>
                <small>Venue-local scheduling</small>
              </div>
              <div>
                <span className="ops-label">Events hosted</span>
                <strong>{upcomingEvents.length}</strong>
                <small>Upcoming Events</small>
              </div>
              <div>
                <span className="ops-label">Organization</span>
                <strong>{organization?.name ?? "—"}</strong>
                <small>Assigned ownership</small>
              </div>
            </div>
          </section>

          {admin.role === "SYSTEM_ADMIN" ||
          admin.organizationIds.includes(venue.organization_id ?? "") ? (
            <div className="admin-resource-panel ops-venue-edit-panel">
              <p className="ops-kicker orange">Venue details</p>
              <h2>Edit venue</h2>
              <ActionForm action={updateVenueState} submitLabel="Save venue">
                <input type="hidden" name="id" value={id} />
                <ProgressiveDisclosureSection
                  id="venue-edit-basics"
                  number="01"
                  title="Venue basics"
                  defaultOpen
                  errorKeywords={["name", "organization", "venue"]}
                >
                  <label>
                    Name
                    <input
                      name="name"
                      required
                      defaultValue={venue.name}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  {venue.organization_id === null ? (
                    <input type="hidden" name="organizationId" value="" />
                  ) : admin.role === "SYSTEM_ADMIN" ? (
                    <label>
                      Organization
                      <select
                        name="organizationId"
                        defaultValue={venue.organization_id ?? ""}
                        className="mt-1 w-full rounded border p-2"
                      >
                        {(organizations ?? []).map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <input
                      type="hidden"
                      name="organizationId"
                      value={venue.organization_id ?? ""}
                    />
                  )}
                </ProgressiveDisclosureSection>
                <ProgressiveDisclosureSection id="venue-edit-address" number="02" title="Address">
                  <label>
                    Street
                    <input
                      name="street"
                      required
                      defaultValue={venue.street}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <label>
                    City
                    <input
                      name="city"
                      required
                      defaultValue={venue.city}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <label>
                    State
                    <input
                      name="state"
                      required
                      defaultValue={venue.state}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <label>
                    Postal code
                    <input
                      name="postalCode"
                      required
                      defaultValue={venue.postal_code}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                </ProgressiveDisclosureSection>
                <ProgressiveDisclosureSection
                  id="venue-edit-timezone"
                  number="03"
                  title="Timezone"
                  defaultOpen
                  errorKeywords={["timezone"]}
                >
                  <label>
                    IANA timezone
                    <input
                      name="timezone"
                      required
                      defaultValue={venue.timezone}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                </ProgressiveDisclosureSection>
              </ActionForm>
              {admin.role === "SYSTEM_ADMIN" && venue.active_status !== "ARCHIVED" ? (
                <form
                  action={async () => {
                    "use server";
                    await archiveVenue(id);
                  }}
                  className="ops-venue-archive-form"
                >
                  <ConfirmSubmit message="Archive this venue? Existing event timestamps will be preserved.">
                    Archive venue
                  </ConfirmSubmit>
                </form>
              ) : null}
            </div>
          ) : null}

          <section className="ops-venue-events-panel">
            <div className="ops-section-head">
              <span className="ops-kicker">Upcoming Event usage</span>
              <Link className="text-button" href={venueDirectoryHref}>
                Back to Venue directory
              </Link>
            </div>
            {upcomingEvents.length ? (
              <div className="ops-venue-related-list">
                {upcomingEvents.map((event) => (
                  <Link key={event.id} href={`/admin/events/${event.id}`}>
                    <strong>{event.name}</strong>
                    <span>
                      {event.status} ·{" "}
                      {new Intl.DateTimeFormat("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: event.timezone,
                      }).format(new Date(event.starts_at))}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="ops-empty">
                <strong>No upcoming Events</strong>
                <p>No upcoming Events currently use this Venue.</p>
                <Link className="text-button" href="/admin/events?mode=create">
                  Create Event
                </Link>
              </div>
            )}
          </section>
        </section>
      </main>
    </>
  );
}
