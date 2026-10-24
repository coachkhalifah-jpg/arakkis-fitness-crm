/**
 * Admin Events calendar-day helpers (UAT-029B).
 * Day membership and Past Events use the admin browser timezone.
 * Do not reuse for UAT-026 month bucketing (America/New_York).
 */

/** Returns `YYYY-MM-DD` for an instant in the given IANA timezone. */
export function eventDayKey(value: string | Date, timeZone: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** True when `startsAt` falls on the same admin-local calendar date as `now`. */
export function isSameAdminLocalDay(startsAt: string | Date, now: Date, timeZone: string): boolean {
  return eventDayKey(startsAt, timeZone) === eventDayKey(now, timeZone);
}

/**
 * Past Events of today (UAT-029B B2):
 * `starts_at < now` and admin-local calendar date equals admin-local today.
 */
export function selectPastEventsOfToday<T extends { startsAt: string }>(
  events: T[],
  now: Date,
  timeZone: string,
): T[] {
  const nowMs = now.getTime();
  return events.filter(
    (event) =>
      Date.parse(event.startsAt) < nowMs && isSameAdminLocalDay(event.startsAt, now, timeZone),
  );
}

/** Browser IANA timezone via Intl (client-only; pass explicitly in tests). */
export function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
