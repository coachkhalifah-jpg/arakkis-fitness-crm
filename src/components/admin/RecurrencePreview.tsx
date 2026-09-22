"use client";

import { features } from "@/lib/features";

export type RecurrencePreviewOccurrence = {
  localDate: string;
  weekdayLabel?: string;
  startTime?: string;
  endTime?: string;
};

export type RecurrencePreviewProps = {
  enabled: boolean;
  occurrenceCount: number;
  firstOccurrence?: string;
  lastOccurrence?: string;
  endsOn?: string;
  selectionWindowDays?: number;
  maxOccurrences?: number;
  occurrences?: RecurrencePreviewOccurrence[];
  weeksTranslated?: number | null;
  className?: string;
};

/**
 * Live series occurrence preview (CE-007 / CE-008 / CE-011).
 * Renders nothing unless `eventRecurrencePreview` is enabled.
 */
export function RecurrencePreview({
  enabled,
  occurrenceCount,
  firstOccurrence,
  lastOccurrence,
  endsOn,
  selectionWindowDays = 14,
  maxOccurrences = 104,
  occurrences = [],
  weeksTranslated = null,
  className,
}: RecurrencePreviewProps) {
  if (!features.eventRecurrencePreview || !enabled) {
    return null;
  }

  const overLimit = occurrenceCount > maxOccurrences;
  const previewRows = occurrences.slice(0, 8);

  return (
    <div
      className={className ?? "rounded border border-[var(--border)] bg-[var(--surface)] p-3 text-sm"}
      role="status"
      aria-live="polite"
    >
      <p className="font-medium">Series preview</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          Dates Arakkis will create:{" "}
          <strong>
            {occurrenceCount}
            {overLimit ? ` (exceeds limit of ${maxOccurrences})` : ""}
          </strong>
        </li>
        {firstOccurrence && lastOccurrence ? (
          <li>
            First → last: {firstOccurrence} → {lastOccurrence}
          </li>
        ) : null}
        {endsOn ? <li>Series end date: {endsOn}</li> : null}
        {weeksTranslated != null ? <li>Resolved from about {weeksTranslated} weeks</li> : null}
        <li>
          Participant selection window: next {selectionWindowDays} days from the series link (not
          the total dates created)
        </li>
      </ul>
      {previewRows.length > 0 ? (
        <div className="mt-3">
          <p className="font-medium">Upcoming generated dates</p>
          <ul className="mt-1 space-y-0.5 pl-1">
            {previewRows.map((row) => (
              <li key={`${row.localDate}-${row.startTime ?? ""}`}>
                {row.weekdayLabel ? `${row.weekdayLabel}, ` : ""}
                {row.localDate}
                {row.startTime && row.endTime ? ` · ${row.startTime}–${row.endTime}` : null}
              </li>
            ))}
            {occurrences.length > previewRows.length ? (
              <li>…and {occurrences.length - previewRows.length} more</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
