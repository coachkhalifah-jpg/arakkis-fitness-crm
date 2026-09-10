"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AdminEventCard } from "@/components/admin/admin-event-card";
import { AdminEventCardRail } from "@/components/admin/admin-event-card-rail";
import { DisclosureToggle } from "@/components/ui/disclosure-toggle";
import { CalendarUtility } from "@/components/admin/calendar-utility";
import { ArchiveCancelledEventButton } from "@/components/admin/archive-cancelled-event-button";
import type { CalendarEvent } from "@/lib/registration/calendar";

export type AdminDiscoveryEvent = {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  status: string;
  publicationStatus: string;
  startsAt: string;
  event: Parameters<typeof AdminEventCard>[0]["event"];
  venueName: string;
  date: Parameters<typeof AdminEventCard>[0]["date"];
  timeLabel: string;
  durationMinutes: number;
  image: string;
  focalPosition?: string;
  count: Parameters<typeof AdminEventCard>[0]["count"];
  firstClassCount: number;
  people: Parameters<typeof AdminEventCard>[0]["people"];
  canViewPhone: boolean;
  canCheckIn: boolean;
  checkInAction: Parameters<typeof AdminEventCard>[0]["checkInAction"];
  removeRegistrationAction: Parameters<typeof AdminEventCard>[0]["removeRegistrationAction"];
  canRemoveRegistration: boolean;
  canArchive: boolean;
  archiveAction: (id: string) => Promise<void>;
};

type Filters = { query: string; organization: string; status: string; from: string; to: string };
const initialFilters: Filters = { query: "", organization: "", status: "", from: "", to: "" };

function isWithinThisWeek(startsAt: string, now = new Date()) {
  const start = now.getTime();
  const end = start + 7 * 24 * 60 * 60 * 1000;
  const eventStart = new Date(startsAt).getTime();
  return eventStart >= start && eventStart < end;
}

function matchesFilters(event: AdminDiscoveryEvent, filters: Filters) {
  const query = filters.query.trim().toLowerCase();
  const starts = new Date(event.startsAt).getTime();
  return (
    (!query || `${event.name} ${event.organizationName}`.toLowerCase().includes(query)) &&
    (!filters.organization || event.organizationId === filters.organization) &&
    (!filters.status ||
      event.status === filters.status ||
      event.publicationStatus === filters.status) &&
    (!filters.from || starts >= new Date(filters.from).getTime()) &&
    (!filters.to || starts <= new Date(filters.to).getTime())
  );
}

function Carousel({
  id,
  events,
  renderCard,
}: {
  id: string;
  events: AdminDiscoveryEvent[];
  renderCard: (event: AdminDiscoveryEvent) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const saved = sessionStorage.getItem(`arakkis:admin-events:carousel:${id}`);
    if (saved && ref.current) ref.current.scrollLeft = Number(saved);
    const element = ref.current;
    if (!element) return;
    const save = () =>
      sessionStorage.setItem(`arakkis:admin-events:carousel:${id}`, String(element.scrollLeft));
    element.addEventListener("scroll", save, { passive: true });
    return () => element.removeEventListener("scroll", save);
  }, [id]);
  return (
    <div id={`organization-events-${id}`} className="admin-event-discovery-carousel-wrap">
      <div
        ref={ref}
        className="event-card-carousel admin-event-discovery-carousel flex gap-4 overflow-x-auto pb-4"
      >
        {events.map(renderCard)}
      </div>
    </div>
  );
}

export function AdminEventsDiscovery({
  events,
  calendarEvents = [],
  calendarError = false,
  initialEventId = null,
}: {
  events: AdminDiscoveryEvent[];
  calendarEvents?: CalendarEvent[];
  calendarError?: boolean;
  initialEventId?: string | null;
}) {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [expanded, setExpanded] = useState<string | null>(null);
  const shouldScrollToExpandedRef = useRef(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersClosing, setFiltersClosing] = useState(false);
  const filterCloseTimer = useRef<number | null>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const openFilters = useCallback(() => {
    if (filterCloseTimer.current !== null) {
      window.clearTimeout(filterCloseTimer.current);
      filterCloseTimer.current = null;
    }
    setFiltersClosing(false);
    setFiltersOpen(true);
  }, []);
  const closeFilters = useCallback(() => {
    if (!filtersOpen || filtersClosing) return;
    setFiltersClosing(true);
    filterCloseTimer.current = window.setTimeout(() => {
      setFiltersOpen(false);
      setFiltersClosing(false);
      filterCloseTimer.current = null;
      filterTriggerRef.current?.focus();
    }, 750);
  }, [filtersClosing, filtersOpen]);
  useEffect(
    () => () => {
      if (filterCloseTimer.current !== null) window.clearTimeout(filterCloseTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!filtersOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeFilters();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeFilters, filtersOpen]);
  const activeFilters = Object.values(filters).some(Boolean);
  const organizations = useMemo(
    () =>
      [
        ...new Map(events.map((event) => [event.organizationId, event.organizationName])).entries(),
      ].sort((a, b) => a[1].localeCompare(b[1])),
    [events],
  );
  const sorted = useMemo(
    () => [...events].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
    [events],
  );
  const filtered = useMemo(
    () => sorted.filter((event) => matchesFilters(event, filters)),
    [sorted, filters],
  );
  const now = new Date();
  const upcoming = sorted.filter((event) => new Date(event.startsAt) >= now);
  const thisWeek = upcoming.filter((event) => isWithinThisWeek(event.startsAt, now));
  const groups = organizations.map(([id, name]) => {
    const groupEvents = upcoming.filter((event) => event.organizationId === id);
    return { id, name, events: groupEvents, upcoming: groupEvents.length };
  });
  const setFilter = (key: keyof Filters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const renderCard = (item: AdminDiscoveryEvent) => (
    <AdminEventCard
      key={item.id}
      event={item.event}
      venueName={item.venueName}
      date={item.date}
      timeLabel={item.timeLabel}
      durationMinutes={item.durationMinutes}
      image={item.image}
      focalPosition={item.focalPosition}
      count={item.count}
      firstClassCount={item.firstClassCount}
      people={item.people}
      canViewPhone={item.canViewPhone}
      canCheckIn={item.canCheckIn}
      checkInAction={item.checkInAction}
      removeRegistrationAction={item.removeRegistrationAction}
      canRemoveRegistration={item.canRemoveRegistration}
      actions={
        item.canArchive ? (
          <ArchiveCancelledEventButton
            eventId={item.id}
            eventName={item.name}
            action={item.archiveAction}
          />
        ) : null
      }
    />
  );

  useEffect(() => {
    const saved = sessionStorage.getItem("arakkis:admin-events:context");
    if (!saved) return;
    try {
      const context = JSON.parse(saved) as {
        filters?: Filters;
        expanded?: string | null;
        scrollY?: number;
      };
      requestAnimationFrame(() => {
        if (context.filters) setFilters(context.filters!);
        if (context.expanded) setExpanded(context.expanded);
        window.scrollTo(0, context.scrollY ?? 0);
      });
    } catch {
      /* stale session state is non-critical */
    }
  }, []);
  useEffect(() => {
    if (!expanded || !shouldScrollToExpandedRef.current) return;
    shouldScrollToExpandedRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`organization-events-${expanded}`)?.scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expanded]);
  useEffect(
    () => () =>
      sessionStorage.setItem(
        "arakkis:admin-events:context",
        JSON.stringify({ filters, expanded, scrollY: window.scrollY }),
      ),
    [filters, expanded],
  );

  return (
    <AdminEventCardRail initialEventId={initialEventId}>
      <div className="admin-event-discovery mt-8">
        <div className="admin-event-discovery-filter-launcher">
          <CalendarUtility events={calendarEvents} error={calendarError} />
          <DisclosureToggle
            ref={filterTriggerRef}
            className="admin-event-discovery-filter-button"
            aria-label="Open event search and filters"
            expanded={filtersOpen}
            controls="admin-event-discovery-filters"
            onClick={filtersOpen ? closeFilters : openFilters}
            showIcon={false}
          >
            <span>Filter</span>
            <span className="admin-event-discovery-filter-arrow" aria-hidden="true">
              ↘
            </span>
            {activeFilters ? (
              <span className="admin-event-discovery-filter-count">Filters active</span>
            ) : null}
          </DisclosureToggle>
          {filtersOpen ? (
            <div
              className={`admin-events-filter-overlay${filtersClosing ? " is-closing" : ""}`}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeFilters();
              }}
            >
              <section
                id="admin-event-discovery-filters"
                className="admin-events-filter-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-events-filter-title"
              >
                <div className="admin-events-filter-sheet-top">
                  <div>
                    <p className="admin-events-filter-kicker">Event collection</p>
                    <h2 id="admin-events-filter-title">Filter events.</h2>
                  </div>
                  <button
                    type="button"
                    className="admin-events-filter-close"
                    onClick={closeFilters}
                    aria-label="Close filters"
                  >
                    ×
                  </button>
                </div>
                <div className="admin-events-filter-form">
                  <label>
                    Search events or organizations
                    <input
                      value={filters.query}
                      onChange={(event) => setFilter("query", event.target.value)}
                      placeholder="Search"
                    />
                  </label>
                  <label>
                    Organization
                    <select
                      value={filters.organization}
                      onChange={(event) => setFilter("organization", event.target.value)}
                    >
                      <option value="">All organizations</option>
                      {organizations.map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      value={filters.status}
                      onChange={(event) => setFilter("status", event.target.value)}
                    >
                      <option value="">All statuses</option>
                      <option value="DRAFT">Draft</option>
                      <option value="PUBLISHED">Published</option>
                      <option value="OPEN">Open</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </label>
                  <label>
                    From{" "}
                    <input
                      type="datetime-local"
                      value={filters.from}
                      onChange={(event) => setFilter("from", event.target.value)}
                    />
                  </label>
                  <label>
                    To{" "}
                    <input
                      type="datetime-local"
                      value={filters.to}
                      onChange={(event) => setFilter("to", event.target.value)}
                    />
                  </label>
                </div>
                <div className="admin-events-filter-actions">
                  <button
                    type="button"
                    className="admin-events-filter-apply"
                    onClick={closeFilters}
                  >
                    Apply filters
                  </button>
                  <button
                    type="button"
                    className="admin-events-filter-clear"
                    onClick={() => {
                      setFilters(initialFilters);
                      closeFilters();
                    }}
                  >
                    Clear and close
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </div>
        {activeFilters ? (
          <section aria-labelledby="filtered-events-heading">
            <div className="admin-event-discovery-heading">
              <h2 id="filtered-events-heading">Results</h2>
              <span>
                {filtered.length} event{filtered.length === 1 ? "" : "s"}
              </span>
            </div>
            <Carousel id="results" events={filtered} renderCard={renderCard} />
          </section>
        ) : (
          <>
            <section aria-labelledby="this-week-heading">
              <div className="admin-event-discovery-heading admin-event-discovery-heading-priority">
                <div>
                  <p className="admin-event-discovery-kicker">Priority view</p>
                  <h2 id="this-week-heading">This week</h2>
                </div>
                <span>
                  {thisWeek.length} event{thisWeek.length === 1 ? "" : "s"}
                </span>
              </div>
              <Carousel id="this-week" events={thisWeek} renderCard={renderCard} />
            </section>
            <section
              className="admin-event-discovery-organizations"
              aria-labelledby="by-organization-heading"
            >
              <div className="admin-event-discovery-heading">
                <h2 id="by-organization-heading">By Organization</h2>
                <span>{groups.length} organizations</span>
              </div>
              {groups.map((group) => (
                <div key={group.id} className="admin-event-organization-group">
                  <DisclosureToggle
                    className="admin-event-organization-toggle"
                    expanded={expanded === group.id}
                    controls={`organization-events-${group.id}`}
                    onClick={() => {
                      if (expanded !== group.id) shouldScrollToExpandedRef.current = true;
                      setExpanded(expanded === group.id ? null : group.id);
                    }}
                  >
                    <strong>{group.name}</strong>
                    <span className="admin-event-organization-count">
                      {group.upcoming} {group.upcoming === 1 ? "event" : "events"}
                    </span>
                  </DisclosureToggle>
                  {expanded === group.id ? (
                    <Carousel
                      id={`organization-${group.id}`}
                      events={group.events}
                      renderCard={renderCard}
                    />
                  ) : null}
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </AdminEventCardRail>
  );
}
