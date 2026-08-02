"use client";

import { useState } from "react";

export function WhatToBring({
  eventId,
  instructions,
}: {
  eventId: string;
  instructions: string[];
}) {
  const [open, setOpen] = useState(false);
  const contentId = `what-to-bring-${eventId}`;

  return (
    <div className={`confirmation-what-to-bring-card${open ? " is-expanded" : ""}`}>
      <button
        type="button"
        className="confirmation-what-to-bring-trigger"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <span className="block font-semibold">What to bring</span>
          <span className="mt-1 block text-sm">{instructions.join(", ")}</span>
        </span>
        <span
          aria-hidden="true"
          className={`confirmation-what-to-bring-chevron${open ? " is-open" : ""}`}
        >
          ›
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
        </div>
      </div>
    </div>
  );
}
