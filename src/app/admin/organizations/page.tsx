import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSystemAdmin } from "@/lib/authorization/server";
import { signOut } from "@/lib/auth/session-actions";
import { createClient } from "@/lib/db/server";
import {
  archiveOrganizationForm,
  archiveVenueForm,
  createOrganization,
  createVenue,
  updateOrganization,
  updateVenueState,
} from "@/lib/services/phase-3-actions";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { AdminWorkspaceMenu } from "@/components/admin/admin-workspace-menu";
import { getAdminWorkspaceMenuItems } from "@/components/admin/admin-workspace-menu-items";
import { ProgressiveDisclosureSection } from "@/components/admin/progressive-disclosure-section";
import { OrganizationCreateDialog } from "@/components/admin/organization-create-dialog";
import { VenueCreateDialog } from "@/components/admin/venue-create-dialog";
import { VenueEditDialog } from "@/components/admin/venue-edit-dialog";

type WorkspaceContext = "organizations" | "public";

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    context?: string;
    mode?: string;
    organization?: string;
    organizationPage?: string;
    venue?: string;
    venueSearch?: string;
  }>;
}) {
  const admin = await requireSystemAdmin("/admin/organizations");
  const params = await searchParams;
  if (params.context === "public") {
    const next = new URLSearchParams();
    if (params.mode === "create-venue") next.set("mode", "create");
    if (params.venue) next.set("venue", params.venue);
    redirect(`/admin/venues?section=public${next.toString() ? `&${next.toString()}` : ""}`);
  }
  const context = "organizations" as WorkspaceContext;
  const mode = params.mode === "create" || params.mode === "create-venue" ? params.mode : "list";
  const db = await createClient();
  const [{ data: organizations }, { data: venues }, { data: events }] = await Promise.all([
    admin.role === "SYSTEM_ADMIN"
      ? db
          .from("organizations")
          .select("id,name,organization_type,active_status,street,city,state,postal_code")
          .order("name")
      : db
          .from("organizations")
          .select("id,name,organization_type,active_status,street,city,state,postal_code")
          .in("id", admin.organizationIds)
          .order("name"),
    admin.role === "SYSTEM_ADMIN"
      ? db
          .from("venues")
          .select("id,name,street,city,state,postal_code,timezone,active_status,organization_id")
          .order("name")
      : db
          .from("venues")
          .select("id,name,street,city,state,postal_code,timezone,active_status,organization_id")
          .in("organization_id", admin.organizationIds)
          .order("name"),
    db
      .from("events")
      .select("id,name,venue_id,host_organization_id,starts_at,status,timezone,capacity")
      .order("starts_at"),
  ]);

  const visibleOrganizations = organizations ?? [];
  const visibleVenues = venues ?? [];
  const venueSearch = params.venueSearch?.trim().toLowerCase() ?? "";
  const organizationEventCounts = new Map<string, { count: number; firstStart: number }>();
  for (const event of events ?? []) {
    if (event.status === "CANCELLED") continue;
    const existing = organizationEventCounts.get(event.host_organization_id);
    const startsAt = Date.parse(event.starts_at);
    organizationEventCounts.set(event.host_organization_id, {
      count: (existing?.count ?? 0) + 1,
      firstStart: Math.min(existing?.firstStart ?? Number.POSITIVE_INFINITY, startsAt),
    });
  }
  const sortedOrganizations = [...visibleOrganizations].sort((a, b) => {
    const aEvents = organizationEventCounts.get(a.id) ?? { count: 0, firstStart: Infinity };
    const bEvents = organizationEventCounts.get(b.id) ?? { count: 0, firstStart: Infinity };
    return (
      bEvents.count - aEvents.count ||
      aEvents.firstStart - bEvents.firstStart ||
      a.name.localeCompare(b.name)
    );
  });
  const organizationPageSize = 3;
  const organizationTotalPages = Math.max(
    1,
    Math.ceil(sortedOrganizations.length / organizationPageSize),
  );
  const requestedOrganizationPage = Number.parseInt(params.organizationPage ?? "1", 10);
  const organizationPage = Math.min(
    organizationTotalPages,
    Math.max(1, Number.isFinite(requestedOrganizationPage) ? requestedOrganizationPage : 1),
  );
  const paginatedOrganizations = sortedOrganizations.slice(
    (organizationPage - 1) * organizationPageSize,
    organizationPage * organizationPageSize,
  );
  const publicVenues = visibleVenues.filter(
    (venue) =>
      venue.organization_id === null &&
      (!venueSearch ||
        `${venue.name} ${venue.city} ${venue.state}`.toLowerCase().includes(venueSearch)),
  );
  const selectedOrganization =
    visibleOrganizations.find((organization) => organization.id === params.organization) ??
    sortedOrganizations[0] ??
    visibleOrganizations[0];
  const selectedPublicVenue =
    publicVenues.find((venue) => venue.id === params.venue) ?? publicVenues[0];
  const selectedOrganizationVenues = selectedOrganization
    ? visibleVenues.filter((venue) => venue.organization_id === selectedOrganization.id)
    : [];
  const selectedOrganizationEvents = selectedOrganization
    ? (events ?? []).filter(
        (event) =>
          event.host_organization_id === selectedOrganization.id && event.status !== "CANCELLED",
      )
    : [];
  const venueEventCounts = new Map<string, number>();
  const venueCapacities = new Map<string, number>();
  for (const event of events ?? []) {
    if (event.status === "CANCELLED") continue;
    venueEventCounts.set(event.venue_id, (venueEventCounts.get(event.venue_id) ?? 0) + 1);
    venueCapacities.set(
      event.venue_id,
      Math.max(venueCapacities.get(event.venue_id) ?? 0, event.capacity),
    );
  }
  const roleLabel = admin.role === "SYSTEM_ADMIN" ? "System Admin" : "Host Admin";
  const contextLabel = "Organizations";
  const scopeLabel =
    admin.role === "SYSTEM_ADMIN" ? "All organizations" : admin.organizationNames.join(" · ");
  const organizationHref = (id: string, page = 1) => {
    const query = new URLSearchParams({ context: "organizations", organization: id });
    if (page > 1) query.set("organizationPage", String(page));
    return `/admin/organizations?${query.toString()}`;
  };
  const organizationPageHref = (page: number) => {
    const query = new URLSearchParams({ context: "organizations" });
    if (params.organization) query.set("organization", params.organization);
    if (page > 1) query.set("organizationPage", String(page));
    return `/admin/organizations?${query.toString()}`;
  };
  const publicVenueHref = (id: string) => `/admin/venues?section=public&venue=${id}`;
  const address = (item: { street: string; city: string; state: string; postal_code: string }) =>
    `${item.street}, ${item.city}, ${item.state} ${item.postal_code}`;

  return (
    <>
      <AdminWorkspaceMenu
        roleLabel={roleLabel}
        scopeLabel={scopeLabel}
        signOutAction={signOut}
        items={getAdminWorkspaceMenuItems(admin.role === "SYSTEM_ADMIN")}
      />
      <main
        className={`ops-page ops-org-page admin-organizations-page admin-organization-venue-workspace ${context === "public" ? "admin-public-venue-workspace" : ""}`}
      >
        <div className="ops-head ops-organizations-head">
          <div>
            <p className="ops-kicker orange">
              {roleLabel} / {contextLabel}
            </p>
            <h1>
              Build the
              <br />
              <em>network.</em>
            </h1>
          </div>
          <div className="ops-context">
            {context === "public" ? (
              <>
                <span className="ops-label">Current scope</span>
                <strong>{scopeLabel}</strong>
                <span className="ops-label">Independent public places for Event operations</span>
              </>
            ) : (
              <>
                <span className="ops-label">Workspace purpose</span>
                <strong>Organizations + venues</strong>
                <span className="ops-label">
                  Organizations can host one-time or recurring events
                </span>
              </>
            )}
          </div>
        </div>

        {context === "organizations" ? (
          <>
            {mode === "create" && admin.role === "SYSTEM_ADMIN" ? (
              <ActionForm
                action={createOrganization}
                submitLabel="Create organization"
                cancelHref="/admin/organizations?context=organizations"
                className="admin-organization-create-form"
              >
                <label>
                  Organization name
                  <input
                    name="name"
                    required
                    maxLength={200}
                    placeholder="Northstar Collective"
                    autoFocus
                  />
                </label>
                <label>
                  Short description
                  <input
                    name="organizationType"
                    maxLength={100}
                    placeholder="What this organization hosts"
                  />
                </label>
              </ActionForm>
            ) : mode === "create-venue" && selectedOrganization ? (
              <VenueForm
                organizations={visibleOrganizations}
                selectedOrganizationId={selectedOrganization.id}
                publicVenue={false}
              />
            ) : (
              <section className="ops-org-layout admin-organizations-layout">
                <aside className="ops-org-index" aria-label="Organizations">
                  <div className="ops-section-head ops-org-section-head">
                    <span className="ops-kicker">Organizations</span>
                    <OrganizationCreateDialog action={createOrganization} />
                  </div>
                  {paginatedOrganizations.map((organization) => (
                    <Link
                      key={organization.id}
                      className={`ops-org-list-item ${organization.id === selectedOrganization?.id ? "is-selected" : ""}`}
                      href={organizationHref(organization.id, organizationPage)}
                      aria-current={
                        organization.id === selectedOrganization?.id ? "page" : undefined
                      }
                    >
                      <span>
                        <strong>{organization.name}</strong>
                        <small>{organization.organization_type || "Organization workspace"}</small>
                      </span>
                      <span className="ops-org-count">
                        {
                          visibleVenues.filter((venue) => venue.organization_id === organization.id)
                            .length
                        }{" "}
                        venues
                        <br />
                        {organizationEventCounts.get(organization.id)?.count ?? 0} events
                      </span>
                    </Link>
                  ))}
                  {!sortedOrganizations.length ? (
                    <p className="admin-org-no-results">No organizations match that search.</p>
                  ) : null}
                  {sortedOrganizations.length > organizationPageSize ? (
                    <nav className="ops-org-pagination" aria-label="Organization pages">
                      {organizationPage > 1 ? (
                        <Link
                          className="ops-org-pagination-button"
                          href={organizationPageHref(organizationPage - 1)}
                          scroll={false}
                          aria-label="Previous organization page"
                        >
                          <span className="arakkis-arrow-icon" aria-hidden="true">
                            ←
                          </span>
                        </Link>
                      ) : (
                        <span className="ops-org-pagination-button is-disabled" aria-hidden="true">
                          <span className="arakkis-arrow-icon">←</span>
                        </span>
                      )}
                      <span className="ops-org-pagination-label">
                        Page {organizationPage} of {organizationTotalPages}
                      </span>
                      {organizationPage < organizationTotalPages ? (
                        <Link
                          className="ops-org-pagination-button"
                          href={organizationPageHref(organizationPage + 1)}
                          scroll={false}
                          aria-label="Next organization page"
                        >
                          <span className="arakkis-arrow-icon" aria-hidden="true">
                            →
                          </span>
                        </Link>
                      ) : (
                        <span className="ops-org-pagination-button is-disabled" aria-hidden="true">
                          <span className="arakkis-arrow-icon">→</span>
                        </span>
                      )}
                    </nav>
                  ) : null}
                </aside>
                {selectedOrganization ? (
                  <section className="ops-org-detail">
                    <div className="ops-org-detail-head">
                      <div>
                        <p className="ops-kicker orange">Selected organization</p>
                        <h2>{selectedOrganization.name}</h2>
                        <p>
                          {selectedOrganization.street
                            ? address(selectedOrganization)
                            : selectedOrganization.organization_type || "Organization workspace"}
                        </p>
                      </div>
                      <div className="ops-org-detail-status-actions">
                        <span className="ops-status">
                          {selectedOrganization.active_status === "ACTIVE" ? "Active" : "Archived"}
                        </span>
                        {admin.role === "SYSTEM_ADMIN" &&
                        selectedOrganization.active_status !== "ARCHIVED" ? (
                          <OrganizationCreateDialog
                            action={updateOrganization}
                            organization={selectedOrganization}
                          />
                        ) : null}
                      </div>
                    </div>
                    <div className="ops-org-stats">
                      <div>
                        <span className="ops-label">Events</span>
                        <strong>{selectedOrganizationEvents.length}</strong>
                        <small>One-time + recurring</small>
                      </div>
                      <div>
                        <span className="ops-label">Venues</span>
                        <strong>{selectedOrganizationVenues.length}</strong>
                        <small>Organization-owned locations</small>
                      </div>
                      <div>
                        <span className="ops-label">Scheduling</span>
                        <strong>
                          {selectedOrganization.active_status === "ACTIVE" ? "Open" : "Closed"}
                        </strong>
                        <small>Available for Event setup</small>
                      </div>
                    </div>
                    <div className="ops-section-head ops-venue-head">
                      <span className="ops-kicker">
                        Venues belonging to {selectedOrganization.name}
                      </span>
                      {selectedOrganization.active_status === "ACTIVE" ? (
                        <VenueCreateDialog
                          action={createVenue}
                          organizationId={selectedOrganization.id}
                          organizationName={selectedOrganization.name}
                        />
                      ) : null}
                    </div>
                    {selectedOrganizationVenues.length ? (
                      <div className="ops-venue-list">
                        {selectedOrganizationVenues.map((venue) => (
                          <VenueEditDialog
                            key={venue.id}
                            variant="row"
                            venue={{ ...venue, eventCount: venueEventCounts.get(venue.id) ?? 0 }}
                            capacity={venueCapacities.get(venue.id) ?? 0}
                            organizations={visibleOrganizations}
                            canChangeOrganization={admin.role === "SYSTEM_ADMIN"}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="ops-empty ops-org-empty">
                        <strong>No venues yet</strong>
                        <p>Add the first venue so this Organization can host an Event.</p>
                        {selectedOrganization.active_status === "ACTIVE" ? (
                          <Link
                            className="text-link"
                            href={`/admin/organizations?context=organizations&mode=create-venue&organization=${selectedOrganization.id}`}
                          >
                            Create Venue
                          </Link>
                        ) : null}
                      </div>
                    )}
                    {admin.role === "SYSTEM_ADMIN" &&
                    selectedOrganization.active_status !== "ARCHIVED" ? (
                      <div className="admin-organizations-rare-actions">
                        <form action={archiveOrganizationForm.bind(null, selectedOrganization.id)}>
                          <ConfirmSubmit message="Archive this organization? Historical relationships will be preserved.">
                            Archive organization
                          </ConfirmSubmit>
                        </form>
                      </div>
                    ) : null}
                  </section>
                ) : (
                  <div className="ops-empty">
                    <strong>No organizations found</strong>
                    <p>Create an Organization to begin scheduling.</p>
                  </div>
                )}
              </section>
            )}
          </>
        ) : (
          <>
            <div className="admin-organization-venue-actions">
              <Link className="button" href="/admin/organizations?context=public&mode=create-venue">
                Add Public Venue
              </Link>
            </div>
            {mode === "create-venue" ? (
              <VenueForm organizations={visibleOrganizations} publicVenue />
            ) : (
              <section className="ops-org-layout admin-organizations-layout admin-public-venues-layout">
                <aside className="ops-org-index" aria-label="Public Venues">
                  <div className="ops-section-head">
                    <span className="ops-kicker">Public Venues</span>
                    <span className="ops-meta">{publicVenues.length} total</span>
                  </div>
                  {publicVenues.map((venue) => (
                    <Link
                      key={venue.id}
                      className={`ops-org-list-item ${venue.id === selectedPublicVenue?.id ? "is-selected" : ""}`}
                      href={publicVenueHref(venue.id)}
                      aria-current={venue.id === selectedPublicVenue?.id ? "page" : undefined}
                    >
                      <span>
                        <strong>{venue.name}</strong>
                        <small>
                          {venue.city}, {venue.state}
                        </small>
                      </span>
                      <span className="ops-org-count">
                        {venueEventCounts.get(venue.id) ?? 0} events
                        <br />
                        {venue.active_status}
                      </span>
                    </Link>
                  ))}
                  {!publicVenues.length ? (
                    <p className="admin-org-no-results">No Public Venues yet.</p>
                  ) : null}
                </aside>
                {selectedPublicVenue ? (
                  <PublicVenueDetail
                    venue={selectedPublicVenue}
                    eventCount={venueEventCounts.get(selectedPublicVenue.id) ?? 0}
                    capacity={venueCapacities.get(selectedPublicVenue.id)}
                    events={(events ?? []).filter(
                      (event) =>
                        event.venue_id === selectedPublicVenue.id && event.status !== "CANCELLED",
                    )}
                  />
                ) : (
                  <div className="ops-empty">
                    <strong>No Public Venues</strong>
                    <p>Add a public place for authorized System Admin Event setup.</p>
                    <Link
                      className="text-link"
                      href="/admin/organizations?context=public&mode=create-venue"
                    >
                      Add Public Venue
                    </Link>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}

function VenueForm({
  organizations,
  selectedOrganizationId = "",
  publicVenue = false,
}: {
  organizations: { id: string; name: string }[];
  selectedOrganizationId?: string;
  publicVenue?: boolean;
}) {
  return (
    <ActionForm
      action={createVenue}
      submitLabel={publicVenue ? "Create Public Venue" : "Create Venue"}
      className="admin-create-event-form admin-resource-form admin-venue-form-shell"
    >
      <ProgressiveDisclosureSection
        id="venue-basics"
        number="01"
        title="Venue identity"
        defaultOpen
        errorKeywords={["venue", "organization", "name"]}
      >
        <label>
          Name
          <input name="name" required className="mt-1 w-full rounded border p-2" />
        </label>
        {publicVenue ? (
          <>
            <input type="hidden" name="organizationId" value="" />
            <p className="admin-create-guidance">Public Venues are not owned by an Organization.</p>
          </>
        ) : (
          <label>
            Organization
            <select
              name="organizationId"
              required
              defaultValue={selectedOrganizationId}
              className="mt-1 w-full rounded border p-2"
            >
              <option value="">Select organization</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </ProgressiveDisclosureSection>
      <ProgressiveDisclosureSection id="venue-address" number="02" title="Address">
        <label>
          Street
          <input name="street" required className="mt-1 w-full rounded border p-2" />
        </label>
        <label>
          City
          <input name="city" required className="mt-1 w-full rounded border p-2" />
        </label>
        <label>
          State
          <input name="state" required className="mt-1 w-full rounded border p-2" />
        </label>
        <label>
          Postal code
          <input name="postalCode" required className="mt-1 w-full rounded border p-2" />
        </label>
      </ProgressiveDisclosureSection>
      <ProgressiveDisclosureSection
        id="venue-timezone"
        number="03"
        title="Timezone"
        defaultOpen
        errorKeywords={["timezone"]}
      >
        <label>
          IANA timezone
          <input
            name="timezone"
            defaultValue="America/New_York"
            required
            className="mt-1 w-full rounded border p-2"
          />
        </label>
      </ProgressiveDisclosureSection>
    </ActionForm>
  );
}

function PublicVenueDetail({
  venue,
  eventCount,
  capacity,
  events,
}: {
  venue: {
    id: string;
    name: string;
    street: string;
    city: string;
    state: string;
    postal_code: string;
    timezone: string;
    active_status: string;
    organization_id: string | null;
  };
  eventCount: number;
  capacity?: number;
  events: { id: string; name: string; status: string; starts_at: string; timezone: string }[];
}) {
  return (
    <section className="ops-org-detail">
      <div className="ops-org-detail-head">
        <div>
          <p className="ops-kicker orange">Selected Public Venue</p>
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
          <span className="ops-label">Venue type</span>
          <strong>Public</strong>
          <small>Independent location</small>
        </div>
        <div>
          <span className="ops-label">Events hosted</span>
          <strong>{eventCount}</strong>
          <small>Organization ownership stays on each Event</small>
        </div>
        <div>
          <span className="ops-label">Timezone</span>
          <strong>{venue.timezone}</strong>
          <small>Venue-local scheduling</small>
        </div>
      </div>
      <div className="admin-public-venue-actions">
        <span className="ops-kicker">Edit or archive this Public Venue</span>
        {venue.active_status !== "ARCHIVED" ? (
          <form action={archiveVenueForm.bind(null, venue.id)}>
            <ConfirmSubmit message="Archive this Public Venue? Existing Event history will be preserved.">
              Archive Public Venue
            </ConfirmSubmit>
          </form>
        ) : null}
      </div>
      {venue.active_status !== "ARCHIVED" ? (
        <ActionForm
          action={updateVenueState}
          submitLabel="Save Public Venue"
          className="admin-public-venue-edit"
        >
          <input type="hidden" name="id" value={venue.id} />
          <input type="hidden" name="organizationId" value="" />
          <ProgressiveDisclosureSection
            id={`public-venue-edit-${venue.id}`}
            number="01"
            title="Edit Venue details"
            defaultOpen
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
      ) : null}
      <section className="ops-venue-events-panel admin-public-venue-events">
        <div className="ops-section-head">
          <span className="ops-kicker">Upcoming Event usage</span>
          <span className="ops-meta">
            {capacity ? `Largest capacity ${capacity}` : "No capacity data"}
          </span>
        </div>
        {events.length ? (
          <div className="ops-organization-related-list">
            {events.map((event) => (
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
            <p>No upcoming Events currently use this Public Venue.</p>
          </div>
        )}
      </section>
    </section>
  );
}
