"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { AdminEventCard } from "@/components/admin/admin-event-card";
import { AdminEventCardRail } from "@/components/admin/admin-event-card-rail";
import { DisclosureToggle } from "@/components/ui/disclosure-toggle";
import { CalendarUtility } from "@/components/admin/calendar-utility";
import { ArchiveCancelledEventButton } from "@/components/admin/archive-cancelled-event-button";
import { EventsBulkLifecycleBar } from "@/components/admin/events-bulk-lifecycle-bar";
import { getBrowserTimeZone, selectPastEventsOfToday } from "@/lib/admin/event-day";
import { eventMonthKey, eventMonthLabel, groupEventsByMonthKey } from "@/lib/admin/event-month";
import type { CalendarEvent } from "@/lib/registration/calendar";

const emptySubscribe = () => () => {};

export type AdminDiscoveryEvent = {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  status: string;
  publicationStatus: string;
  startsAt: string;
  archivedAt: string | null;
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
  canRemoveRegistration: boolean;
  canArchive: boolean;
};

type Filters = {
  query: string;
  organization: string;
  status: string;
  from: string;
  to: string;
  months: string[];
};
const initialFilters: Filters = {
  query: "",
  organization: "",
  status: "",
  from: "",
  to: "",
  months: [],
};

function isWithinThisWeek(startsAt: string, now = new Date()) {
  const start = now.getTime();
  const end = start + 7 * 24 * 60 * 60 * 1000;
  const eventStart = new Date(startsAt).getTime();
  return eventStart >= start && eventStart < end;
}

function matchesNonMonthFilters(
  event: AdminDiscoveryEvent,
  filters: Omit<Filters, "months"> | Filters,
) {
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

function matchesFilters(event: AdminDiscoveryEvent, filters: Filters) {
  if (!matchesNonMonthFilters(event, filters)) return false;
  if (!filters.months.length) return true;
  return filters.months.includes(eventMonthKey(event.startsAt));
}

function hasActiveFilters(filters: Filters) {
  return Boolean(
    filters.query ||
    filters.organization ||
    filters.status ||
    filters.from ||
    filters.to ||
    filters.months.length,
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
  canBulkManage = false,
}: {
  events: AdminDiscoveryEvent[];
  calendarEvents?: CalendarEvent[];
  calendarError?: boolean;
  initialEventId?: string | null;
  canBulkManage?: boolean;
}) {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const shouldScrollToExpandedRef = useRef(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersClosing, setFiltersClosing] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
  const activeFilters = hasActiveFilters(filters);
  const monthsSelected = filters.months.length > 0;
  const nonMonthFiltersActive = Boolean(
    filters.query || filters.organization || filters.status || filters.from || filters.to,
  );
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
  const baseFiltered = useMemo(
    () => sorted.filter((event) => matchesNonMonthFilters(event, filters)),
    [sorted, filters],
  );
  const availableMonths = useMemo(() => {
    const keys = new Set(baseFiltered.map((event) => eventMonthKey(event.startsAt)));
    return [...keys].sort().map((key) => ({ key, label: eventMonthLabel(key) }));
  }, [baseFiltered]);
  const filtered = useMemo(
    () => sorted.filter((event) => matchesFilters(event, filters)),
    [sorted, filters],
  );
  // UAT-029B B1: calendar day / Past Events use admin browser timezone (not UAT-026 NY months).
  const adminTimeZone = useSyncExternalStore<string | null>(
    emptySubscribe,
    getBrowserTimeZone,
    () => null,
  );
  const now = new Date();
  const filteredUpcoming = filtered.filter((event) => new Date(event.startsAt) >= now);
  const thisWeek = filteredUpcoming.filter((event) => isWithinThisWeek(event.startsAt, now));
  const pastEventsOfToday = adminTimeZone
    ? selectPastEventsOfToday(filtered, now, adminTimeZone)
    : [];
  const monthGroups = useMemo(() => groupEventsByMonthKey(filtered), [filtered]);
  const groups = organizations
    .map(([id, name]) => {
      const groupEvents = filteredUpcoming.filter((event) => event.organizationId === id);
      return { id, name, events: groupEvents, upcoming: groupEvents.length };
    })
    .filter((group) => group.upcoming > 0);
  const setFilter = (key: "query" | "organization" | "status" | "from" | "to", value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const toggleMonth = (monthKey: string) => {
    setFilters((current) => {
      const selected = current.months.includes(monthKey)
        ? current.months.filter((item) => item !== monthKey)
        : [...current.months, monthKey].sort();
      return { ...current, months: selected };
    });
  };
  const clearSelection = useCallback(() => setSelectedIds([]), []);
  const toggleSelected = useCallback((id: string, selected: boolean) => {
    setSelectedIds((current) => {
      if (selected) return current.includes(id) ? current : [...current, id];
      return current.filter((item) => item !== id);
    });
  }, []);
  const selectedEvents = useMemo(
    () =>
      events
        .filter((event) => selectedIds.includes(event.id))
        .map((event) => ({
          id: event.id,
          status: event.status,
          archivedAt: event.archivedAt,
        })),
    [events, selectedIds],
  );
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
      canRemoveRegistration={item.canRemoveRegistration}
      selectionMode={selectionMode}
      selected={selectedIds.includes(item.id)}
      onSelectedChange={(selected) => toggleSelected(item.id, selected)}
      actions={
        item.canArchive ? (
          <ArchiveCancelledEventButton eventId={item.id} eventName={item.name} />
        ) : null
      }
    />
  );
  // UAT-029B B3: Past Events after upcoming priority; omit when empty.
  const pastEventsSection =
    pastEventsOfToday.length > 0 ? (
      <section
        aria-labelledby="past-events-heading"
        data-testid="admin-event-discovery-past-events"
      >
        <div className="admin-event-discovery-heading">
          <h2 id="past-events-heading">Past Events</h2>
          <span>
            {pastEventsOfToday.length} event{pastEventsOfToday.length === 1 ? "" : "s"}
          </span>
        </div>
        <Carousel id="past-events" events={pastEventsOfToday} renderCard={renderCard} />
      </section>
    ) : null;

  useEffect(() => {
    const saved = sessionStorage.getItem("arakkis:admin-events:context");
    if (!saved) return;
    try {
      const context = JSON.parse(saved) as {
        filters?: Partial<Filters> & { months?: string[] };
        expanded?: string | null;
        expandedOrg?: string | null;
        expandedMonth?: string | null;
        scrollY?: number;
      };
      requestAnimationFrame(() => {
        if (context.filters) {
          setFilters({
            ...initialFilters,
            ...context.filters,
            months: Array.isArray(context.filters.months) ? context.filters.months : [],
          });
        }
        if (context.expandedOrg) setExpandedOrg(context.expandedOrg);
        else if (context.expanded) setExpandedOrg(context.expanded);
        if (context.expandedMonth) setExpandedMonth(context.expandedMonth);
        window.scrollTo(0, context.scrollY ?? 0);
      });
    } catch {
      /* stale session state is non-critical */
    }
  }, []);
  useEffect(() => {
    if (!expandedOrg || !shouldScrollToExpandedRef.current) return;
    shouldScrollToExpandedRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`organization-events-${expandedOrg}`)?.scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expandedOrg]);
  useEffect(
    () => () =>
      sessionStorage.setItem(
        "arakkis:admin-events:context",
        JSON.stringify({
          filters,
          expandedOrg,
          expandedMonth,
          scrollY: window.scrollY,
        }),
      ),
    [filters, expandedOrg, expandedMonth],
  );

  return (
    <AdminEventCardRail initialEventId={initialEventId}>
      <div className="admin-event-discovery mt-8">
        <div className="admin-event-discovery-filter-launcher">
          <CalendarUtility events={calendarEvents} error={calendarError} />
          {canBulkManage ? (
            <button
              type="button"
              className={`admin-event-discovery-select-button${selectionMode ? " is-active" : ""}`}
              aria-pressed={selectionMode}
              onClick={() => {
                setSelectionMode((current) => {
                  if (current) clearSelection();
                  return !current;
                });
              }}
            >
              {selectionMode ? "Done selecting" : "Select"}
            </button>
          ) : null}
          <div className="admin-event-discovery-filter-trigger-group">
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
            </DisclosureToggle>
            {activeFilters ? (
              <span className="admin-event-discovery-filter-count" aria-live="polite">
                Filters active
              </span>
            ) : null}
          </div>
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
                  <fieldset className="admin-events-filter-months">
                    <legend>Months</legend>
                    <p className="admin-events-filter-months-hint">
                      Multiselect calendar months (New York). Leave empty to keep the default This
                      week / By Organization view.
                    </p>
                    {availableMonths.length ? (
                      <div
                        className="admin-events-filter-month-chips"
                        role="group"
                        aria-label="Months"
                      >
                        {availableMonths.map((month) => {
                          const selected = filters.months.includes(month.key);
                          return (
                            <button
                              key={month.key}
                              type="button"
                              className={`admin-events-filter-month-chip${selected ? " is-selected" : ""}`}
                              aria-pressed={selected}
                              onClick={() => toggleMonth(month.key)}
                            >
                              {month.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="admin-events-filter-months-empty">
                        No months in the current set.
                      </p>
                    )}
                  </fieldset>
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
        {monthsSelected ? (
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
            {pastEventsSection}
            <section
              className="admin-event-discovery-months"
              aria-labelledby="by-month-heading"
              data-testid="admin-event-discovery-months"
            >
              <div className="admin-event-discovery-heading">
                <div>
                  <p className="admin-event-discovery-kicker">Filter-aware</p>
                  <h2 id="by-month-heading">By month</h2>
                </div>
                <span>
                  {monthGroups.length} month{monthGroups.length === 1 ? "" : "s"} ·{" "}
                  {filtered.length} event{filtered.length === 1 ? "" : "s"}
                </span>
              </div>
              {monthGroups.length ? (
                monthGroups.map((group) => (
                  <div key={group.key} className="admin-event-organization-group">
                    <DisclosureToggle
                      className="admin-event-organization-toggle"
                      expanded={expandedMonth === group.key}
                      controls={`organization-events-month-${group.key}`}
                      onClick={() =>
                        setExpandedMonth(expandedMonth === group.key ? null : group.key)
                      }
                    >
                      <strong>{group.label}</strong>
                      <span className="admin-event-organization-count">
                        {group.events.length} {group.events.length === 1 ? "event" : "events"}
                      </span>
                    </DisclosureToggle>
                    {expandedMonth === group.key ? (
                      <Carousel
                        id={`month-${group.key}`}
                        events={group.events}
                        renderCard={renderCard}
                      />
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="admin-event-discovery-empty">No events match the current filters.</p>
              )}
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
                    expanded={expandedOrg === group.id}
                    controls={`organization-events-${group.id}`}
                    onClick={() => {
                      if (expandedOrg !== group.id) shouldScrollToExpandedRef.current = true;
                      setExpandedOrg(expandedOrg === group.id ? null : group.id);
                    }}
                  >
                    <strong>{group.name}</strong>
                    <span className="admin-event-organization-count">
                      {group.upcoming} {group.upcoming === 1 ? "event" : "events"}
                    </span>
                  </DisclosureToggle>
                  {expandedOrg === group.id ? (
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
        ) : nonMonthFiltersActive ? (
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
            {pastEventsSection}
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
                    expanded={expandedOrg === group.id}
                    controls={`organization-events-${group.id}`}
                    onClick={() => {
                      if (expandedOrg !== group.id) shouldScrollToExpandedRef.current = true;
                      setExpandedOrg(expandedOrg === group.id ? null : group.id);
                    }}
                  >
                    <strong>{group.name}</strong>
                    <span className="admin-event-organization-count">
                      {group.upcoming} {group.upcoming === 1 ? "event" : "events"}
                    </span>
                  </DisclosureToggle>
                  {expandedOrg === group.id ? (
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
        {canBulkManage && selectionMode && selectedIds.length > 0 ? (
          <EventsBulkLifecycleBar
            selectedIds={selectedIds}
            selectedEvents={selectedEvents}
            onClear={clearSelection}
          />
        ) : null}
      </div>
    </AdminEventCardRail>
  );
}
