"use client";

import { useState } from "react";
import { useEffect, useRef } from "react";

export function WhatToBring({
  eventId,
  instructions,
}: {
  eventId: string;
  instructions: string[];
}) {
  const [open, setOpen] = useState(false);
  const contentId = `what-to-bring-${eventId}`;
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      triggerRef.current?.focus();
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className={`confirmation-what-to-bring-card${open ? " is-expanded" : ""}`}>
      <button
        type="button"
        ref={triggerRef}
        className="confirmation-what-to-bring-trigger"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="confirmation-what-to-bring-label">
          <span className="block font-semibold">What to bring</span>
        </span>
        <span
          aria-hidden="true"
          className={`confirmation-what-to-bring-chevron${open ? " is-open" : ""}`}
        >
          ⋮
        </span>
      </button>

      <div
        id={contentId}
        className={`confirmation-what-to-bring-content-wrap${open ? " is-open" : ""}`}
        aria-hidden={!open}
      >
        <div className="confirmation-what-to-bring-content">
          <ul className="space-y-2 leading-7">
            {instructions.map((instruction, index) => (
              <li key={`${eventId}-expanded-instruction-${index}`}>{instruction}</li>
            ))}
          </ul>
          <button
            type="button"
            className="confirmation-what-to-bring-close"
            aria-label="Close What to bring"
            onClick={() => setOpen(false)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>
    </div>
  );
}
