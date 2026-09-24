/** Coerce IANA timezones for Intl; invalid/nullish values fall back to UTC. */
export function safeTimezone(timezone: string | null | undefined): string {
  const candidate = typeof timezone === "string" && timezone.trim() ? timezone.trim() : "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date(0));
    return candidate;
  } catch {
    return "UTC";
  }
}

/** Coerce timestamps for Intl/Date; invalid/nullish values fall back to epoch. */
export function safeDate(value: string | number | Date | null | undefined): Date {
  if (value == null || value === "") return new Date(0);
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

export function formatInTimezone(
  value: string | number | Date | null | undefined,
  timezone: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  locale = "en-US",
) {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: safeTimezone(timezone),
  }).format(safeDate(value));
}

export function formatToPartsInTimezone(
  value: string | number | Date | null | undefined,
  timezone: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  locale = "en-US",
) {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: safeTimezone(timezone),
  }).formatToParts(safeDate(value));
}
