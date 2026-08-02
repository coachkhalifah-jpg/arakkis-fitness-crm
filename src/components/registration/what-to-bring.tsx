"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function WhatToBring({
  eventId,
  instructions,
}: {
  eventId: string;
  instructions: string[];
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = `what-to-bring-${eventId}`;
  const contentId = `what-to-bring-content-${eventId}`;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key !== "Tab" || !sheetRef.current) return;
      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [open]);

  const sheet = open ? (
    <div className="confirmation-sheet-layer">
      <button
        type="button"
        className="confirmation-sheet-backdrop"
        aria-label="Close What to Bring"
        onClick={() => setOpen(false)}
      />
      <div
        ref={sheetRef}
        className="confirmation-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={contentId}
      >
        <div className="confirmation-sheet-header">
          <h2 id={titleId} className="confirmation-section-title text-center">
            What to Bring
          </h2>
        </div>
        <div id={contentId} className="confirmation-sheet-content">
          <ul className="confirmation-info-card-list confirmation-body">
            {instructions.map((instruction, index) => (
              <li key={`${eventId}-instruction-${index}`}>{instruction}</li>
            ))}
          </ul>
        </div>
        <div className="confirmation-sheet-actions">
          <button
            ref={closeRef}
            type="button"
            className="confirmation-sheet-close"
            aria-label="Close What to Bring"
            onClick={() => setOpen(false)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="confirmation-what-to-bring-card confirmation-info-card confirmation-sheet-trigger"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="confirmation-info-card-icon" aria-hidden="true">
          ✓
        </span>
        <span className="confirmation-sheet-trigger-copy">
          <span className="confirmation-section-title" role="heading" aria-level={2}>
            What to Bring
          </span>
          <span className="confirmation-sheet-trigger-arrow" aria-hidden="true">
            ›
          </span>
        </span>
      </button>
      {typeof document !== "undefined" && sheet ? createPortal(sheet, document.body) : null}
    </>
  );
}
