/** ISO weekday 1–7 (Monday–Sunday) for a calendar date (YYYY-MM-DD). */
export function weekdayForLocalDate(value: string): number {
  return Number(new Date(`${value}T00:00:00Z`).getUTCDay()) || 7;
}

/** Advance a calendar date by one day (UTC date arithmetic for date-only values). */
export function addCalendarDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Snap a calendar effective date forward to the selected ISO weekday.
 * Preserves the chosen date when it already matches.
 */
export function alignDateToWeekday(date: string, weekday: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || weekday < 1 || weekday > 7) return date;
  let current = date;
  for (let step = 0; step < 7; step += 1) {
    if (weekdayForLocalDate(current) === weekday) return current;
    current = addCalendarDays(current, 1);
  }
  return date;
}

/**
 * Next local calendar date for the selected weekday at/after "now" in the
 * Venue timezone. Mirrors the prior Manage-series helper so existing TZ
 * behavior is preserved.
 */
export function nextDateForWeekday(weekday: number, localTime: string, timezone: string): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const currentWeekday =
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
      parts.find((part) => part.type === "weekday")?.value ?? "",
    ) + 1;
  const currentTime = `${parts.find((part) => part.type === "hour")?.value ?? "00"}:${parts.find((part) => part.type === "minute")?.value ?? "00"}`;
  let days = (weekday - currentWeekday + 7) % 7;
  if (days === 0 && localTime <= currentTime) days = 7;
  // Preserve prior Manage-series arithmetic: offset from the instantaneous UTC
  // calendar day after resolving weekday/time in the Venue timezone.
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
