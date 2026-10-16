/** Admin discovery month bucketing — America/New_York wall time (UAT-026 / Batch 13b). */

export const ADMIN_EVENT_MONTH_TZ = "America/New_York";

/** Returns `YYYY-MM` for an event start instant in New York. */
export function eventMonthKey(startsAt: string | Date, timeZone = ADMIN_EVENT_MONTH_TZ): string {
  const date = typeof startsAt === "string" ? new Date(startsAt) : startsAt;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

/** Short label like `Oct 2026`. */
export function eventMonthLabel(monthKey: string, timeZone = ADMIN_EVENT_MONTH_TZ): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  // Noon UTC on the 15th avoids DST edge cases when formatting the month name.
  const sample = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    year: "numeric",
  }).format(sample);
}

export function groupEventsByMonthKey<T extends { startsAt: string }>(
  events: T[],
  timeZone = ADMIN_EVENT_MONTH_TZ,
): { key: string; label: string; events: T[] }[] {
  const buckets = new Map<string, T[]>();
  for (const event of events) {
    const key = eventMonthKey(event.startsAt, timeZone);
    const list = buckets.get(key);
    if (list) list.push(event);
    else buckets.set(key, [event]);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, monthEvents]) => ({
      key,
      label: eventMonthLabel(key, timeZone),
      events: monthEvents,
    }));
}
