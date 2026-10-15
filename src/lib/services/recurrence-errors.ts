import { z } from "zod";

const SCHEDULE_ERROR_KEYWORDS =
  /schedule|series|occurrence|effective|timezone|overlap|duplicate|unique|request|System Admin|Venue|Organization|successor|canonical|registration window|local time/i;

const ACTIONABLE_FALLBACK =
  /P0002|23505|22023|42501|40901|does not exist|could not|cannot|failed|invalid|required|outside|within|already|no valid|overlaps|not found|must be|is after|is outside/i;

function textField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function collectPostgrestParts(error: object): string[] {
  const record = error as Record<string, unknown>;
  return [record.message, record.details, record.hint].map(textField).filter(Boolean);
}

/**
 * Map add/change/stop/extend failures to operator-facing copy.
 * PostgREST RPC errors are often plain objects (or Error subclasses) with
 * message/details/hint — not always `instanceof Error` with keyword matches.
 */
export function safeScheduleMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Check the schedule details.";
  }

  if (typeof error === "object" && error !== null) {
    const parts = collectPostgrestParts(error);
    const schedulePart = parts.find((part) => SCHEDULE_ERROR_KEYWORDS.test(part));
    if (schedulePart) return schedulePart;

    const actionablePart = parts.find((part) => ACTIONABLE_FALLBACK.test(part));
    if (actionablePart) return actionablePart;

    if (parts.length > 0) {
      const combined = parts.join(" — ");
      if (SCHEDULE_ERROR_KEYWORDS.test(combined) || ACTIONABLE_FALLBACK.test(combined)) {
        return combined;
      }
    }
  }

  if (error instanceof Error && error.message) {
    if (SCHEDULE_ERROR_KEYWORDS.test(error.message) || ACTIONABLE_FALLBACK.test(error.message)) {
      return error.message;
    }
  }

  return "The schedule change could not be completed.";
}
