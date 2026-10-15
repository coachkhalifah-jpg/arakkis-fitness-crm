import { z } from "zod";
import { Phase3Error } from "@/lib/services/phase-3";

function readTrimmedField(error: unknown, key: string): string | undefined {
  if (typeof error !== "object" || error === null || !(key in error)) return undefined;
  const value = (error as Record<string, unknown>)[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Surface actionable schedule RPC / validation reasons to the Admin banner.
 * Prefer message, details, and hint when the database or client provided them;
 * only fall back to the opaque generic when nothing useful is available.
 */
export function safeScheduleMessage(error: unknown): string {
  if (error instanceof Phase3Error) return error.message;
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Check the schedule details.";
  }

  const message =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : readTrimmedField(error, "message");
  const details = readTrimmedField(error, "details");
  const hint = readTrimmedField(error, "hint");

  const parts = [message, details, hint].filter((part): part is string => Boolean(part));
  if (parts.length > 0) {
    // Deduplicate when PostgREST repeats the same text across fields.
    return [...new Set(parts)].join(" — ");
  }

  return "The schedule change could not be completed.";
}
