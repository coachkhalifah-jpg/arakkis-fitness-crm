"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActionForm } from "@/components/admin/action-form";
import type { Phase3ActionState } from "@/lib/services/phase-3-actions";

type CreateVenueAction = (state: Phase3ActionState, form: FormData) => Promise<Phase3ActionState>;

export function VenueCreateDialog({
  action,
  organizationId,
  organizationName,
  organizations = [],
  allowPublicVenue = false,
}: {
  action: CreateVenueAction;
  organizationId?: string;
  organizationName?: string;
  organizations?: Array<{ id: string; name: string }>;
  allowPublicVenue?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [relationship, setRelationship] = useState<"organization" | "public" | null>(
    organizationId ? "organization" : null,
  );
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
      <button
        type="button"
        className="ops-venue-add-button"
        onClick={() => {
          setClosing(false);
          setRelationship(organizationId ? "organization" : null);
          setOpen(true);
        }}
      >
        + New venue
      </button>
      {open ? (
        <div className="admin-events-page admin-organization-create-shell">
          <div
            className={`admin-events-filter-overlay${closing ? " is-closing" : ""}`}
            id="venue-create-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="venue-create-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            {relationship === null ? (
              <section
                className="admin-events-filter-sheet admin-venue-relationship-sheet"
                aria-labelledby="venue-create-title"
              >
                <div className="admin-events-filter-sheet-top">
                  <div>
                    <p className="admin-events-filter-kicker">New venue</p>
                    <h2 id="venue-create-title">Choose the relationship.</h2>
                  </div>
                  <button
                    type="button"
                    className="admin-events-filter-close"
                    onClick={close}
                    aria-label="Close venue selection"
                  >
                    ×
                  </button>
                </div>
                <div className="admin-venue-relationship-options">
                  <button
                    type="button"
                    className="admin-venue-relationship-option"
                    onClick={() => setRelationship("organization")}
                  >
                    <strong>Organization Venue</strong>
                    <span>
                      Organization required{" "}
                      <span className="arakkis-arrow-icon" aria-hidden="true">
                        ↗
                      </span>
                    </span>
                  </button>
                  {allowPublicVenue ? (
                    <button
                      type="button"
                      className="admin-venue-relationship-option"
                      onClick={() => setRelationship("public")}
                    >
                      <strong>Public Venue</strong>
                      <span>
                        Independent location{" "}
                        <span className="arakkis-arrow-icon" aria-hidden="true">
                          ↗
                        </span>
                      </span>
                    </button>
                  ) : null}
                </div>
              </section>
            ) : (
              <ActionForm
                action={action}
                submitLabel="Create venue"
                cancelAction={close}
                actionsClassName="admin-events-filter-actions"
                submitClassName="admin-events-filter-apply"
                cancelClassName="admin-events-filter-clear"
                className="admin-events-filter-sheet"
              >
                <div className="admin-events-filter-sheet-top">
                  <div>
                    <p className="admin-events-filter-kicker">Venue collection</p>
                    <h2 id="venue-create-title">Create venue.</h2>
                  </div>
                  <button
                    type="button"
                    className="admin-events-filter-close"
                    onClick={close}
                    aria-label="Close venue form"
                  >
                    ×
                  </button>
                </div>
                <div className="admin-events-filter-form">
                  <label>
                    Venue name
                    <input
                      name="name"
                      required
                      maxLength={200}
                      placeholder="Williamsburg Studio"
                      autoFocus
                    />
                  </label>
                  {relationship === "organization" && organizationId && organizationName ? (
                    <label>
                      Organization
                      <input
                        value={organizationName}
                        readOnly
                        aria-describedby="venue-organization-scope"
                      />
                      <input type="hidden" name="organizationId" value={organizationId} />
                      <span id="venue-organization-scope" className="admin-create-guidance">
                        This venue will belong to the selected organization.
                      </span>
                    </label>
                  ) : relationship === "organization" ? (
                    <label>
                      Organization
                      <select name="organizationId" defaultValue="">
                        {organizations.map((organization) => (
                          <option key={organization.id} value={organization.id}>
                            {organization.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <input type="hidden" name="organizationId" value="" />
                  )}
                  <label>
                    Street
                    <input name="street" required maxLength={200} placeholder="186 Wythe Ave" />
                  </label>
                  <label>
                    City
                    <input name="city" required maxLength={100} placeholder="Brooklyn" />
                  </label>
                  <label>
                    State
                    <input name="state" required maxLength={50} placeholder="NY" />
                  </label>
                  <label>
                    Postal code
                    <input name="postalCode" required maxLength={20} placeholder="11249" />
                  </label>
                  <label>
                    IANA timezone
                    <input
                      name="timezone"
                      required
                      defaultValue="America/New_York"
                      placeholder="America/New_York"
                    />
                  </label>
                </div>
              </ActionForm>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
