"use client";

import { useState, type ReactNode } from "react";
import { DisclosureToggle } from "@/components/ui/disclosure-toggle";

export function PeopleProfileDisclosure({
  id,
  title,
  meta,
  children,
  defaultOpen = false,
}: {
  id: string;
  title: string;
  meta?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const titleId = `${id}-title`;
  const contentId = `${id}-content`;

  return (
    <section
      className={`ops-venue-events-panel ops-people-profile-disclosure${open ? " is-open" : ""}`}
      aria-labelledby={titleId}
      data-testid={`people-profile-disclosure-${id}`}
    >
      <DisclosureToggle
        className="ops-people-profile-disclosure-toggle"
        expanded={open}
        controls={contentId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="ops-people-profile-disclosure-head">
          <span className="ops-kicker" id={titleId}>
            {title}
          </span>
          {meta ? <span className="ops-label">{meta}</span> : null}
        </span>
      </DisclosureToggle>
      <div id={contentId} className="ops-people-profile-disclosure-content" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
