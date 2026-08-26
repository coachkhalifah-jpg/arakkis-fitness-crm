"use client";

import { useEffect, useRef, useState } from "react";
import { DisclosureToggle } from "@/components/ui/disclosure-toggle";
import { googleCalendarUrl, type CalendarEvent } from "@/lib/registration/calendar";

export function CalendarUtility({
  events,
  error = false,
  single = false,
}: {
  events: CalendarEvent[];
  error?: boolean;
  single?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mobileMenuTop, setMobileMenuTop] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = `calendar-utility-${single ? "event" : "week"}`;
  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const updateMobileMenuPosition = () => {
      if (window.matchMedia("(max-width: 640px)").matches && triggerRef.current) {
        setMobileMenuTop(triggerRef.current.getBoundingClientRect().bottom + 8);
      } else {
        setMobileMenuTop(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    updateMobileMenuPosition();
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updateMobileMenuPosition);
    window.addEventListener("scroll", updateMobileMenuPosition, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updateMobileMenuPosition);
      window.removeEventListener("scroll", updateMobileMenuPosition, true);
    };
  }, [open]);

  if (single && events[0]) {
    return (
      <div className="admin-calendar-single-actions">
        <a
          className="admin-calendar-direct-action"
          href={googleCalendarUrl(events[0])}
          target="_blank"
          rel="noreferrer"
          aria-label={`Add ${events[0].name} to Google Calendar (opens in a new tab)`}
        >
          <span>Add to Google Calendar</span>
          <span className="arakkis-arrow-icon" aria-hidden="true">
            ↗
          </span>
        </a>
        <a
          className="admin-calendar-download"
          href="/admin/calendar/this-week.ics"
          download="arakkis-this-week.ics"
        >
          <span>Add to iCal</span>
          <span className="arakkis-arrow-icon" aria-hidden="true">
            ↗
          </span>
        </a>
      </div>
    );
  }

  return (
    <div className="admin-calendar-utility">
      <DisclosureToggle
        ref={triggerRef}
        className="admin-calendar-trigger"
        expanded={open}
        controls={menuId}
        aria-label="Open Calendar options"
        onClick={() => setOpen((current) => !current)}
      >
        Calendar
      </DisclosureToggle>
      {open ? (
        <div
          id={menuId}
          className="admin-calendar-menu"
          style={mobileMenuTop === null ? undefined : { top: `${mobileMenuTop}px` }}
          role="dialog"
          aria-label="Calendar options"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="admin-calendar-menu-heading">
            <span>Add this week to calendar</span>
            <button type="button" onClick={close} aria-label="Close Calendar options">
              ×
            </button>
          </div>
          {error ? (
            <p className="admin-calendar-message">Calendar is temporarily unavailable.</p>
          ) : events.length === 0 ? (
            <p className="admin-calendar-message">No eligible upcoming Events are available.</p>
          ) : (
            <div className="admin-calendar-menu-actions" aria-label="Calendar providers">
              <a
                className="admin-calendar-menu-action"
                href={googleCalendarUrl(events[0])}
                target="_blank"
                rel="noreferrer"
                aria-label={`Add ${events[0].name} to Google Calendar (opens in a new tab)`}
              >
                Add to Google Calendar{" "}
                <span className="arakkis-arrow-icon" aria-hidden="true">
                  ↗
                </span>
              </a>
              <a
                className="admin-calendar-menu-action"
                href="/admin/calendar/this-week.ics"
                download="arakkis-this-week.ics"
              >
                Add to iCal{" "}
                <span className="arakkis-arrow-icon" aria-hidden="true">
                  ↗
                </span>
              </a>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
