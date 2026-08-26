"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { ProgressiveDisclosureSection } from "@/components/admin/progressive-disclosure-section";
import { updateVenueState } from "@/lib/services/phase-3-actions";

type Venue = {
  id: string;
  name: string;
  street: string;
  city: string;
  state: string;
  postal_code: string;
  timezone: string;
  organization_id: string | null;
  eventCount: number;
};

export function VenueEditDialog({
  venue,
  organizations,
  canChangeOrganization,
  variant = "card",
  capacity = 0,
}: {
  venue: Venue;
  organizations: Array<{ id: string; name: string; active_status: string }>;
  canChangeOrganization: boolean;
  variant?: "card" | "row";
  capacity?: number;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const close = useCallback(() => {
    if (!open || closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      closeTimer.current = null;
    }, 750);
  }, [closing, open]);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  return (
    <>
      {variant === "row" ? (
        <button
          type="button"
          className={`ops-venue-row admin-venue-row-trigger${open ? " is-selected" : ""}`}
          onClick={() => {
            setClosing(false);
            setOpen(true);
          }}
          aria-label={`Edit ${venue.name}`}
        >
          <div className="ops-venue-identity">
            <strong>{venue.name}</strong>
            <span>
              {venue.street}, {venue.city}, {venue.state} {venue.postal_code}
            </span>
          </div>
          <div>
            <span className="ops-label">Capacity</span>
            <strong>{capacity}</strong>
          </div>
          <div>
            <span className="ops-label">Events hosted</span>
            <strong>{venue.eventCount}</strong>
          </div>
          <div className="ops-venue-arrow" aria-hidden="true">
            <span className="arakkis-arrow-icon">↗</span>
          </div>
        </button>
      ) : (
        <button
          type="button"
          className={`ops-org-list-item admin-venue-card${open ? " is-selected" : ""}`}
          onClick={() => {
            setClosing(false);
            setOpen(true);
          }}
          aria-label={`Edit ${venue.name}`}
        >
          <span>
            <strong>{venue.name}</strong>
            <small>
              {venue.street}, {venue.city}, {venue.state} {venue.postal_code}
            </small>
          </span>
          <span className="ops-org-count">
            {venue.organization_id
              ? (organizations.find((organization) => organization.id === venue.organization_id)
                  ?.name ?? "Unavailable organization")
              : "Independent public venue"}
            <br />
            {venue.eventCount} events
          </span>
        </button>
      )}
      {open ? (
        <div className="admin-events-page admin-organization-create-shell">
          <div
            className={`admin-events-filter-overlay${closing ? " is-closing" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`venue-edit-title-${venue.id}`}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <ActionForm
              action={updateVenueState}
              submitLabel="Save venue"
              cancelAction={close}
              actionsClassName="admin-events-filter-actions"
              submitClassName="admin-events-filter-apply"
              cancelClassName="admin-events-filter-clear"
              className="admin-events-filter-sheet admin-venue-edit-sheet"
            >
              <div className="admin-events-filter-sheet-top">
                <div>
                  <p className="admin-events-filter-kicker">Edit venue</p>
                  <h2 id={`venue-edit-title-${venue.id}`}>Update place.</h2>
                </div>
                <button
                  type="button"
                  className="admin-events-filter-close"
                  onClick={close}
                  aria-label="Close venue editor"
                >
                  ×
                </button>
              </div>
              <input type="hidden" name="id" value={venue.id} />
              <section className="admin-venue-edit-events-summary" aria-label="Hosted events">
                <h3>Events</h3>
                <strong>{venue.eventCount}</strong>
                <p>
                  One-time +<br />
                  Recurring
                </p>
              </section>
              <div className="admin-events-filter-form">
                <ProgressiveDisclosureSection
                  id={`venue-edit-basics-${venue.id}`}
                  number="01"
                  title="Venue basics"
                  defaultOpen
                >
                  <label>
                    Name
                    <input name="name" required defaultValue={venue.name} />
                  </label>
                  {venue.organization_id === null ? (
                    <input type="hidden" name="organizationId" value="" />
                  ) : canChangeOrganization ? (
                    <label>
                      Organization
                      <select name="organizationId" defaultValue={venue.organization_id}>
                        {organizations.map((organization) => (
                          <option key={organization.id} value={organization.id}>
                            {organization.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <input type="hidden" name="organizationId" value={venue.organization_id} />
                  )}
                </ProgressiveDisclosureSection>
                <ProgressiveDisclosureSection
                  id={`venue-edit-address-${venue.id}`}
                  number="02"
                  title="Address"
                >
                  <label>
                    Street
                    <input name="street" required defaultValue={venue.street} />
                  </label>
                  <label>
                    City
                    <input name="city" required defaultValue={venue.city} />
                  </label>
                  <label>
                    State
                    <input name="state" required defaultValue={venue.state} />
                  </label>
                  <label>
                    Postal code
                    <input name="postalCode" required defaultValue={venue.postal_code} />
                  </label>
                </ProgressiveDisclosureSection>
                <ProgressiveDisclosureSection
                  id={`venue-edit-timezone-${venue.id}`}
                  number="03"
                  title="Timezone"
                  defaultOpen
                >
                  <label>
                    IANA timezone
                    <input name="timezone" required defaultValue={venue.timezone} />
                  </label>
                </ProgressiveDisclosureSection>
              </div>
            </ActionForm>
          </div>
        </div>
      ) : null}
    </>
  );
}
