"use client";

import { useEffect, useRef, useState } from "react";

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
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
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
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) triggerRef.current?.focus();
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="confirmation-what-to-bring-trigger"
        aria-expanded={open}
        aria-controls={`what-to-bring-${eventId}`}
        onClick={() => setOpen(true)}
      >
        <span>
          <span className="block font-semibold">What to bring</span>
          <span className="mt-1 block text-sm">{instructions.join(", ")}</span>
        </span>
        <span aria-hidden="true" className="text-xl leading-none">
          ›
        </span>
      </button>

      {open ? (
        <div
          className="confirmation-what-to-bring-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            ref={dialogRef}
            id={`what-to-bring-${eventId}`}
            className="confirmation-what-to-bring-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`what-to-bring-title-${eventId}`}
          >
            <div className="confirmation-what-to-bring-header">
              <h2 id={`what-to-bring-title-${eventId}`} className="text-base font-semibold">
                What to bring
              </h2>
            </div>
            <div className="confirmation-what-to-bring-content">
              <ul className="space-y-2 leading-7">
                {instructions.map((instruction, index) => (
                  <li key={`${eventId}-expanded-instruction-${index}`}>{instruction}</li>
                ))}
              </ul>
            </div>
            <button
              ref={closeRef}
              type="button"
              className="confirmation-what-to-bring-close"
              aria-label="Close What to bring"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
