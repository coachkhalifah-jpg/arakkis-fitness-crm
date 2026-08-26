import Link from "next/link";
import { requireActiveAdmin } from "@/lib/authorization/server";
import { signOut } from "@/lib/auth/session-actions";
import { createClient } from "@/lib/db/server";
import { createVenue } from "@/lib/services/phase-3-actions";
import { ActionForm } from "@/components/admin/action-form";
import { AdminWorkspaceMenu } from "@/components/admin/admin-workspace-menu";
import { getAdminWorkspaceMenuItems } from "@/components/admin/admin-workspace-menu-items";
import { ProgressiveDisclosureSection } from "@/components/admin/progressive-disclosure-section";
import { VenueCreateDialog } from "@/components/admin/venue-create-dialog";
import { VenueEditDialog } from "@/components/admin/venue-edit-dialog";
import {
  VenueInventoryDisclosure,
  VenueInventoryDisclosureContent,
  VenueInventoryDisclosureToggle,
} from "@/components/admin/venue-inventory-disclosure";
import {
  isVenueInventorySectionOpen,
  resolveVenueInventorySection,
} from "@/lib/admin/venue-inventory";

export default async function VenuesPage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    type?: string;
    section?: string;
    organization?: string;
    venue?: string;
    venuePage?: string;
    publicVenuePage?: string;
  }>;
}) {
  const admin = await requireActiveAdmin("/admin/venues");
  const params = await searchParams;
  const activeSection = resolveVenueInventorySection(params.section);
  const db = await createClient();
  const [{ data: organizations }, { data: venues }, { data: events }] = await Promise.all([
    db.from("organizations").select("id,name,active_status").order("name"),
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
    db.from("events").select("id,venue_id,status,starts_at").order("starts_at"),
  ]);
  const visibleOrganizations = (organizations ?? []).filter(
    (organization) =>
      admin.role === "SYSTEM_ADMIN" || admin.organizationIds.includes(organization.id),
  );
  const visibleVenues = venues ?? [];
  const eventCount = (venueId: string) =>
    (events ?? []).filter((event) => event.venue_id === venueId && event.status !== "CANCELLED")
      .length;
  const roleLabel = admin.role === "SYSTEM_ADMIN" ? "System Admin" : "Host Admin";
  const scopeLabel =
    admin.role === "SYSTEM_ADMIN" ? "All organizations" : admin.organizationNames.join(" · ");
  const mode = params.mode === "create" ? "create" : "list";
  const sortedVenues = [...visibleVenues].sort((a, b) => a.name.localeCompare(b.name));
  const organizationVenues = sortedVenues.filter((venue) => venue.organization_id !== null);
  const publicVenues = sortedVenues.filter((venue) => venue.organization_id === null);
  const venuePageSize = 3;
  const venueTotalPages = Math.max(1, Math.ceil(organizationVenues.length / venuePageSize));
  const requestedVenuePage = Number.parseInt(params.venuePage ?? "1", 10);
  const venuePage = Math.min(
    venueTotalPages,
    Math.max(1, Number.isFinite(requestedVenuePage) ? requestedVenuePage : 1),
  );
  const paginatedVenues = organizationVenues.slice(
    (venuePage - 1) * venuePageSize,
    venuePage * venuePageSize,
  );
  const venuePageHref = (nextPage: number) =>
    `/admin/venues?section=organization&venuePage=${nextPage}`;
  const publicVenueTotalPages = Math.max(1, Math.ceil(publicVenues.length / venuePageSize));
  const requestedPublicVenuePage = Number.parseInt(params.publicVenuePage ?? "1", 10);
  const publicVenuePage = Math.min(
    publicVenueTotalPages,
    Math.max(1, Number.isFinite(requestedPublicVenuePage) ? requestedPublicVenuePage : 1),
  );
  const paginatedPublicVenues = publicVenues.slice(
    (publicVenuePage - 1) * venuePageSize,
    publicVenuePage * venuePageSize,
  );
  const publicVenuePageHref = (nextPage: number) =>
    `/admin/venues?section=public&publicVenuePage=${nextPage}`;
  return (
    <>
      <AdminWorkspaceMenu
        roleLabel={roleLabel}
        scopeLabel={scopeLabel}
        signOutAction={signOut}
        items={getAdminWorkspaceMenuItems(admin.role === "SYSTEM_ADMIN")}
      />
      <main className="ops-page ops-org-page ops-venue-page admin-venues-page admin-organization-venue-workspace">
        <VenueInventoryDisclosure
          key={activeSection}
          defaultOpen={isVenueInventorySectionOpen(activeSection, "organization")}
        >
          <div className="ops-head ops-venue-page-head">
            <div>
              <p className="ops-kicker orange">{roleLabel} / Venues</p>
              <div className="admin-venues-page-head-add">
                <VenueCreateDialog
                  action={createVenue}
                  organizations={visibleOrganizations}
                  allowPublicVenue={admin.role === "SYSTEM_ADMIN"}
                />
              </div>
              <h1>
                Find the
                <br />
                <em>right place.</em>
              </h1>
            </div>
            <div className="ops-context">
              <span className="ops-label orange">01 / Organization-owned</span>
              <div className="admin-venues-inventory-heading">
                <VenueInventoryDisclosureToggle title="Organization venues" />
                <span className="admin-venues-inventory-count">
                  {organizationVenues.length} locations
                </span>
              </div>
            </div>
          </div>

          {mode === "create" ? (
            <section className="admin-venue-create-choice" aria-labelledby="add-venue-heading">
              <div className="ops-section-head">
                <span className="ops-kicker" id="add-venue-heading">
                  Add venue
                </span>
              </div>
              <div className="admin-venue-create-options">
                <Link
                  className="ops-org-list-item"
                  href={`/admin/venues?mode=create&type=organization${params.organization ? `&organization=${params.organization}` : ""}`}
                >
                  <span>
                    <strong>Organization Venue</strong>
                    <small>Belongs to a hosting Organization</small>
                  </span>
                  <span className="arakkis-arrow-icon" aria-hidden="true">
                    ↗
                  </span>
                </Link>
                {admin.role === "SYSTEM_ADMIN" ? (
                  <Link className="ops-org-list-item" href="/admin/venues?mode=create&type=public">
                    <span>
                      <strong>Public Venue</strong>
                      <small>Independent location with no Organization owner</small>
                    </span>
                    <span className="arakkis-arrow-icon" aria-hidden="true">
                      ↗
                    </span>
                  </Link>
                ) : null}
              </div>
              {params.type === "organization" ? (
                <VenueForm
                  organizations={visibleOrganizations}
                  selectedOrganizationId={params.organization ?? ""}
                  publicVenue={false}
                />
              ) : null}
              {params.type === "public" && admin.role === "SYSTEM_ADMIN" ? (
                <VenueForm organizations={visibleOrganizations} publicVenue />
              ) : null}
            </section>
          ) : (
            <>
              <VenueInventoryDisclosureContent>
                <VenueInventoryRows
                  venues={paginatedVenues}
                  organizations={visibleOrganizations}
                  eventCount={eventCount}
                  page={venuePage}
                  totalPages={venueTotalPages}
                  pageHref={venuePageHref}
                  ariaLabel="Organization venues"
                  canChangeOrganization={admin.role === "SYSTEM_ADMIN"}
                />
              </VenueInventoryDisclosureContent>
              {admin.role === "SYSTEM_ADMIN" ? (
                <div className="admin-venues-public-disclosure">
                  <VenueInventoryDisclosure
                    key={activeSection}
                    defaultOpen={isVenueInventorySectionOpen(activeSection, "public")}
                  >
                    <div className="admin-venues-public-heading">
                      <span className="ops-label orange">02 / Independent access</span>
                      <div className="admin-venues-inventory-heading">
                        <VenueInventoryDisclosureToggle title="Public venues" />
                        <span className="admin-venues-inventory-count">
                          {publicVenues.length} locations
                        </span>
                      </div>
                    </div>
                    <VenueInventoryDisclosureContent>
                      <VenueInventoryRows
                        venues={paginatedPublicVenues}
                        organizations={visibleOrganizations}
                        eventCount={eventCount}
                        page={publicVenuePage}
                        totalPages={publicVenueTotalPages}
                        pageHref={publicVenuePageHref}
                        ariaLabel="Public venues"
                        canChangeOrganization
                      />
                    </VenueInventoryDisclosureContent>
                  </VenueInventoryDisclosure>
                </div>
              ) : null}
            </>
          )}
        </VenueInventoryDisclosure>
      </main>
    </>
  );
}

function VenueInventoryRows({
  venues,
  organizations,
  eventCount,
  page,
  totalPages,
  pageHref,
  ariaLabel,
  canChangeOrganization,
}: {
  venues: Array<{
    id: string;
    name: string;
    street: string;
    city: string;
    state: string;
    postal_code: string;
    timezone: string;
    organization_id: string | null;
  }>;
  organizations: Array<{ id: string; name: string; active_status: string }>;
  eventCount: (id: string) => number;
  page: number;
  totalPages: number;
  pageHref: (page: number) => string;
  ariaLabel: string;
  canChangeOrganization: boolean;
}) {
  return (
    <section className="ops-org-index admin-venues-index" aria-label={ariaLabel}>
      {venues.map((venue) => (
        <VenueEditDialog
          key={venue.id}
          venue={{ ...venue, eventCount: eventCount(venue.id) }}
          organizations={organizations}
          canChangeOrganization={canChangeOrganization}
        />
      ))}
      {!venues.length ? <p className="admin-org-no-results">No venues found.</p> : null}
      {venues.length > 0 && totalPages > 1 ? (
        <nav className="ops-org-pagination" aria-label={`${ariaLabel} pages`}>
          {page > 1 ? (
            <Link
              className="ops-org-pagination-button"
              href={pageHref(page - 1)}
              scroll={false}
              aria-label={`Previous ${ariaLabel.toLowerCase()} page`}
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
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              className="ops-org-pagination-button"
              href={pageHref(page + 1)}
              scroll={false}
              aria-label={`Next ${ariaLabel.toLowerCase()} page`}
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
    </section>
  );
}

function VenueForm({
  organizations,
  selectedOrganizationId = "",
  publicVenue = false,
}: {
  organizations: Array<{ id: string; name: string; active_status: string }>;
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
            <p className="admin-create-guidance">
              Public Venues remain independent of Organizations.
            </p>
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
