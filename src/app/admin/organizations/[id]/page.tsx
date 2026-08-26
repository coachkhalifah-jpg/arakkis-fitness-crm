import Link from "next/link";
import { requireSystemAdmin } from "@/lib/authorization/server";
import { signOut } from "@/lib/auth/session-actions";
import { createClient } from "@/lib/db/server";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { AdminWorkspaceMenu } from "@/components/admin/admin-workspace-menu";
import { getAdminWorkspaceMenuItems } from "@/components/admin/admin-workspace-menu-items";
import { SegmentedNavigation } from "@/components/admin/segmented-navigation";
import { ContextualBack } from "@/components/admin/contextual-back";
import { ProgressiveDisclosureSection } from "@/components/admin/progressive-disclosure-section";
import { archiveOrganization, updateOrganization } from "@/lib/services/phase-3-actions";
import { PublicErrorState } from "@/components/registration/public-error-state";

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireSystemAdmin(`/admin/organizations/${id}`);
  const db = await createClient();
  const [{ data: organization }, { data: venues }, { data: events }] = await Promise.all([
    db.from("organizations").select("*").eq("id", id).single(),
    db
      .from("venues")
      .select("id,name,active_status,timezone")
      .eq("organization_id", id)
      .order("name"),
    db
      .from("events")
      .select("id,name,status,starts_at,timezone")
      .eq("host_organization_id", id)
      .order("starts_at", { ascending: false }),
  ]);

  if (!organization) {
    return (
      <PublicErrorState
        code="404"
        title="Organization not found."
        message="The requested Organization does not exist."
        actionLabel="Return to organizations"
        actionHref="/admin/organizations"
      />
    );
  }

  const address = organization.street
    ? `${organization.street}, ${organization.city ?? ""}, ${organization.state ?? ""} ${organization.postal_code ?? ""}`
    : organization.organization_type || "Organization workspace";
  // Organization detail is an operational/upcoming view; historical Events
  // remain available from the Events workspace but do not belong here.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const upcomingEvents = (events ?? []).filter(
    (event) =>
      Date.parse(event.starts_at) >= now &&
      event.status !== "COMPLETED" &&
      event.status !== "CANCELLED",
  );

  return (
    <>
      <AdminWorkspaceMenu
        roleLabel="System Admin"
        scopeLabel="All organizations"
        signOutAction={signOut}
        items={getAdminWorkspaceMenuItems()}
      />
      <main className="ops-page ops-org-page admin-organizations-page ops-organization-detail-page">
        <ContextualBack href={`/admin/organizations?organization=${id}`} label="Organizations" />
        <div className="ops-head ops-organizations-head">
          <div>
            <p className="ops-kicker orange">System Admin / Organization</p>
            <h1>
              Build the
              <br />
              <em>network.</em>
            </h1>
          </div>
          <div className="ops-context">
            <span className="ops-label">Current scope</span>
            <strong>All organizations</strong>
            <span className="ops-label">Organization detail and operating relationships</span>
          </div>
        </div>
        <div className="admin-organizations-mode-row">
          <SegmentedNavigation
            listLabel="Organizations"
            actionLabel="Create"
            actionHref="/admin/organizations?mode=create"
          />
        </div>

        <section className="ops-organization-detail-content">
          <div className="ops-org-detail-head">
            <div>
              <p className="ops-kicker orange">Selected organization</p>
              <h2>{organization.name}</h2>
              <p>{address}</p>
            </div>
            <span className="ops-status">
              {organization.active_status === "ACTIVE" ? "Active" : "Archived"}
            </span>
          </div>
          <div className="ops-org-stats">
            <div>
              <span className="ops-label">Venues</span>
              <strong>{venues?.length ?? 0}</strong>
              <small>Organization-owned locations</small>
            </div>
            <div>
              <span className="ops-label">Events hosted</span>
              <strong>{upcomingEvents.length}</strong>
              <small>Upcoming one-time + recurring</small>
            </div>
            <div>
              <span className="ops-label">Scheduling</span>
              <strong>{organization.active_status === "ACTIVE" ? "Open" : "Closed"}</strong>
              <small>Available for Event setup</small>
            </div>
          </div>

          <div className="ops-organization-detail-grid">
            <section className="ops-organization-panel" aria-labelledby="organization-edit-heading">
              <div className="ops-section-head">
                <span className="ops-kicker" id="organization-edit-heading">
                  Organization details
                </span>
              </div>
              <ActionForm
                action={updateOrganization}
                submitLabel="Save organization"
                className="admin-create-event-form admin-resource-form"
              >
                <input type="hidden" name="id" value={id} />
                <ProgressiveDisclosureSection
                  id="organization-edit-identity"
                  number="01"
                  title="Organization identity"
                  defaultOpen
                  errorKeywords={["name", "organization"]}
                >
                  <label>
                    Name
                    <input
                      name="name"
                      required
                      defaultValue={organization.name}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <label>
                    Type
                    <input
                      name="organizationType"
                      defaultValue={organization.organization_type ?? ""}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                </ProgressiveDisclosureSection>
                <ProgressiveDisclosureSection
                  id="organization-edit-address"
                  number="02"
                  title="Address and operating information"
                >
                  <label>
                    Street
                    <input
                      name="street"
                      defaultValue={organization.street ?? ""}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <label>
                    City
                    <input
                      name="city"
                      defaultValue={organization.city ?? ""}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <label>
                    State
                    <input
                      name="state"
                      defaultValue={organization.state ?? ""}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <label>
                    Postal code
                    <input
                      name="postalCode"
                      defaultValue={organization.postal_code ?? ""}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                </ProgressiveDisclosureSection>
              </ActionForm>
              {organization.active_status !== "ARCHIVED" ? (
                <form
                  action={async () => {
                    "use server";
                    await archiveOrganization(id);
                  }}
                  className="admin-organizations-rare-actions"
                >
                  <ConfirmSubmit message="Archive this organization? Historical relationships will be preserved.">
                    Archive organization
                  </ConfirmSubmit>
                </form>
              ) : null}
            </section>

            <div className="ops-organization-related">
              <section
                className="ops-organization-panel"
                aria-labelledby="organization-venues-heading"
              >
                <div className="ops-section-head">
                  <span className="ops-kicker" id="organization-venues-heading">
                    Venue directory
                  </span>
                  <Link className="text-button" href={`/admin/venues?organization=${id}`}>
                    View venues ↗
                  </Link>
                </div>
                <div className="ops-organization-related-list">
                  {(venues ?? []).map((venue) => (
                    <Link key={venue.id} href={`/admin/venues/${venue.id}?from=organization`}>
                      <strong>{venue.name}</strong>
                      <span>
                        {venue.timezone} · {venue.active_status}
                      </span>
                    </Link>
                  ))}
                  {!venues?.length ? (
                    <p className="ops-organization-empty">
                      No venues yet.{" "}
                      <Link href={`/admin/venues?mode=create&organization=${id}`}>
                        Create a venue
                      </Link>
                    </p>
                  ) : null}
                </div>
              </section>
              <section
                className="ops-organization-panel"
                aria-labelledby="organization-events-heading"
              >
                <div className="ops-section-head">
                  <span className="ops-kicker" id="organization-events-heading">
                    Events hosted
                  </span>
                  <Link className="text-button" href={`/admin/events?organization=${id}`}>
                    View events ↗
                  </Link>
                </div>
                <div className="ops-organization-related-list">
                  {upcomingEvents.map((event) => (
                    <Link key={event.id} href={`/admin/events/${event.id}?from=organization`}>
                      <strong>{event.name}</strong>
                      <span>
                        {event.status} · {event.timezone}
                      </span>
                    </Link>
                  ))}
                  {!upcomingEvents.length ? (
                    <p className="ops-organization-empty">
                      No upcoming Events hosted by this organization.
                    </p>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
