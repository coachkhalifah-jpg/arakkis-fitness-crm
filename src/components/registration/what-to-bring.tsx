"use client";

import { useState } from "react";
import { useEffect, useRef } from "react";
import { ArakkisCard } from "@/components/registration/arakkis-card";
import { DisclosureToggle } from "@/components/ui/disclosure-toggle";

export function WhatToBring({
  eventId,
  instructions,
  variant = "legacy",
}: {
  eventId: string;
  instructions: string[];
  variant?: "legacy" | "northstar";
}) {
  const [open, setOpen] = useState(variant === "northstar");
  const contentId = `what-to-bring-${eventId}`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const preview = instructions.slice(0, 3).join(" • ") + (instructions.length > 3 ? " + more" : "");

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

  if (variant === "northstar") {
    return (
      <div className={`confirmation-prep${open ? " is-expanded" : ""}`}>
        <DisclosureToggle
          ref={triggerRef}
          className="confirmation-prep-toggle"
          expanded={open}
          controls={contentId}
          onClick={() => setOpen((current) => !current)}
        >
          <span>Before you arrive</span>
        </DisclosureToggle>
        <div
          id={contentId}
          className={`confirmation-prep-content${open ? " is-open" : ""}`}
          aria-hidden={!open}
        >
          <p>{instructions.join("\n")}</p>
        </div>
      </div>
    );
  }

  return (
    <ArakkisCard
      interactive
      className={`confirmation-what-to-bring-card${open ? " is-expanded" : ""}`}
    >
      <DisclosureToggle
        ref={triggerRef}
        className="confirmation-what-to-bring-trigger"
        expanded={open}
        controls={contentId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="confirmation-what-to-bring-label">
          <span className="confirmation-what-to-bring-preview">{preview}</span>
        </span>
      </DisclosureToggle>

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
    </ArakkisCard>
  );
}
