"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActionForm } from "@/components/admin/action-form";
import type { Phase3ActionState } from "@/lib/services/phase-3-actions";

type CreateAction = (state: Phase3ActionState, form: FormData) => Promise<Phase3ActionState>;

type Organization = {
  id: string;
  name: string;
  organization_type: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
};

export function OrganizationCreateDialog({
  action,
  organization,
}: {
  action: CreateAction;
  organization?: Organization;
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
      <button
        type="button"
        className="ops-org-add-link"
        onClick={() => {
          setClosing(false);
          setOpen(true);
        }}
      >
        {organization ? (
          <>
            Edit organization{" "}
            <span className="arakkis-arrow-icon" aria-hidden="true">
              ↗
            </span>
          </>
        ) : (
          "+ New organization"
        )}
      </button>
      {open ? (
        <div className="admin-events-page admin-organization-create-shell">
          <div
            className={`admin-events-filter-overlay${closing ? " is-closing" : ""}`}
            id="organization-create-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby={organization ? "organization-edit-title" : "organization-create-title"}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <ActionForm
              action={action}
              submitLabel={organization ? "Save organization" : "Create organization"}
              cancelAction={close}
              actionsClassName="admin-events-filter-actions"
              submitClassName="admin-events-filter-apply"
              cancelClassName="admin-events-filter-clear"
              className="admin-events-filter-sheet"
            >
              <div className="admin-events-filter-sheet-top">
                <div>
                  <p className="admin-events-filter-kicker">Organization collection</p>
                  <h2 id={organization ? "organization-edit-title" : "organization-create-title"}>
                    {organization ? "Edit organization." : "Create organization."}
                  </h2>
                </div>
                <button
                  type="button"
                  className="admin-events-filter-close"
                  onClick={close}
                  aria-label="Close organization form"
                >
                  ×
                </button>
              </div>
              {organization ? <input type="hidden" name="id" value={organization.id} /> : null}
              <div className="admin-events-filter-form">
                <label>
                  Organization name
                  <input
                    name="name"
                    required
                    maxLength={200}
                    placeholder="Northstar Collective"
                    defaultValue={organization?.name ?? ""}
                    autoFocus
                  />
                </label>
                <label>
                  Short description
                  <input
                    name="organizationType"
                    maxLength={100}
                    placeholder="What this organization hosts"
                    defaultValue={organization?.organization_type ?? ""}
                  />
                </label>
                <label>
                  Street
                  <input
                    name="street"
                    maxLength={200}
                    placeholder="1 Main Street"
                    defaultValue={organization?.street ?? ""}
                  />
                </label>
                <label>
                  City
                  <input
                    name="city"
                    maxLength={100}
                    placeholder="Albany"
                    defaultValue={organization?.city ?? ""}
                  />
                </label>
                <label>
                  State
                  <input
                    name="state"
                    maxLength={50}
                    placeholder="NY"
                    defaultValue={organization?.state ?? ""}
                  />
                </label>
                <label>
                  Postal code
                  <input
                    name="postalCode"
                    maxLength={20}
                    placeholder="12207"
                    defaultValue={organization?.postal_code ?? ""}
                  />
                </label>
              </div>
            </ActionForm>
          </div>
        </div>
      ) : null}
    </>
  );
}
