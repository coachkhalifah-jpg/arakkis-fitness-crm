"use client";

import { useEffect, type ReactNode } from "react";

/** Series-style Stop panel: trigger stays compact; details open in an overlay sheet. */
export function PeopleDestructiveActionSheet({
  open,
  onClose,
  title,
  kicker = "People",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  kicker?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="admin-events-page ops-people-destructive-shell">
      <div
        className="admin-events-filter-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="people-destructive-sheet-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="admin-events-filter-sheet admin-manage-event-series-sheet ops-people-destructive-sheet">
          <div className="admin-events-filter-sheet-top">
            <div>
              <p className="admin-events-filter-kicker">{kicker}</p>
              <h2 id="people-destructive-sheet-title">{title}</h2>
            </div>
            <button
              type="button"
              className="admin-events-filter-close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="admin-events-filter-form admin-series-panel-form">{children}</div>
        </div>
      </div>
    </div>
  );
}
