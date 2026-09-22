"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { features } from "@/lib/features";

export type PublishConfirmationSummary = {
  name: string;
  organizationName: string;
  venueName: string;
  timezone: string;
  scheduleSummary: string;
  occurrenceCount?: number;
  firstOccurrence?: string;
  lastOccurrence?: string;
  capacityPerClass: number | string;
  deadlineBehavior: string;
  visibilityLabel: string;
  accessModeLabel: string;
  hasParticipantContent: boolean;
  hasImage: boolean;
};

type PublishConfirmationModalProps = {
  open: boolean;
  summary: PublishConfirmationSummary | null;
  onCancel: () => void;
  onConfirm: () => void;
  confirming?: boolean;
};

/**
 * Pre-publish operational review modal (CE-011).
 * Renders nothing unless `eventPublishConfirmation` is enabled.
 */
export function PublishConfirmationModal({
  open,
  summary,
  onCancel,
  onConfirm,
  confirming = false,
}: PublishConfirmationModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !features.eventPublishConfirmation) return;
    if (open && summary) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, summary]);

  if (!features.eventPublishConfirmation || !open || !summary) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      className="admin-publish-confirm-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div className="space-y-4 p-4">
        <h2 id={titleId} className="text-lg font-semibold">
          Review before publishing
        </h2>
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="font-medium">Event</dt>
            <dd>{summary.name || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium">Organization</dt>
            <dd>{summary.organizationName || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium">Venue / timezone</dt>
            <dd>
              {summary.venueName || "—"} ({summary.timezone || "—"})
            </dd>
          </div>
          <div>
            <dt className="font-medium">Schedule</dt>
            <dd>{summary.scheduleSummary || "—"}</dd>
          </div>
          {summary.occurrenceCount != null ? (
            <div>
              <dt className="font-medium">Occurrences</dt>
              <dd>
                {summary.occurrenceCount}
                {summary.firstOccurrence && summary.lastOccurrence
                  ? ` (${summary.firstOccurrence} → ${summary.lastOccurrence})`
                  : null}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="font-medium">Capacity per class</dt>
            <dd>{summary.capacityPerClass}</dd>
          </div>
          <div>
            <dt className="font-medium">Registration deadline</dt>
            <dd>{summary.deadlineBehavior || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium">Visibility / access</dt>
            <dd>
              {summary.visibilityLabel} · {summary.accessModeLabel}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Participant content</dt>
            <dd>{summary.hasParticipantContent ? "Present" : "Not set (optional)"}</dd>
          </div>
          <div>
            <dt className="font-medium">Event image</dt>
            <dd>{summary.hasImage ? "Attached" : "Not set (optional)"}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={confirming}>
            Back to edit
          </Button>
          <Button type="button" onClick={onConfirm} loading={confirming}>
            Confirm publish
          </Button>
        </div>
      </div>
    </dialog>
  );
}
