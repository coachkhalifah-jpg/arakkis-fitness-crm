"use client";

import { useActionState, useEffect, useState } from "react";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { PeopleDestructiveActionSheet } from "@/components/admin/people-destructive-action-sheet";
import {
  bulkArchiveCancelledEvents,
  bulkCancelEvents,
  bulkDeleteLeanEvents,
  type Phase3ActionState,
} from "@/lib/services/phase-3-actions";

type BulkMode = "cancel" | "archive" | "lean-delete" | null;

export function EventsBulkLifecycleBar({
  selectedIds,
  selectedEvents,
  onClear,
}: {
  selectedIds: string[];
  selectedEvents: { id: string; status: string; archivedAt: string | null }[];
  onClear: () => void;
}) {
  const [mode, setMode] = useState<BulkMode>(null);
  const [cancelState, cancelAction] = useActionState<Phase3ActionState, FormData>(
    bulkCancelEvents,
    {},
  );
  const [archiveState, archiveAction] = useActionState<Phase3ActionState, FormData>(
    bulkArchiveCancelledEvents,
    {},
  );
  const [deleteState, deleteAction] = useActionState<Phase3ActionState, FormData>(
    bulkDeleteLeanEvents,
    {},
  );

  // Lifecycle guard: only DRAFT/OPEN may transition to CANCELLED (0014).
  const cancellable = selectedEvents.filter(
    (event) => event.status === "DRAFT" || event.status === "OPEN",
  );
  const archivable = selectedEvents.filter(
    (event) => event.status === "CANCELLED" && !event.archivedAt,
  );

  useEffect(() => {
    if (cancelState.success || archiveState.success || deleteState.success) onClear();
  }, [archiveState.success, cancelState.success, deleteState.success, onClear]);

  if (!selectedIds.length) return null;

  const activeState =
    mode === "cancel" ? cancelState : mode === "archive" ? archiveState : deleteState;

  return (
    <div className="admin-events-bulk-bar" data-testid="admin-events-bulk-bar">
      <div className="admin-events-bulk-bar-summary">
        <strong>
          {selectedIds.length} selected
        </strong>
        <button type="button" className="admin-events-bulk-clear" onClick={onClear}>
          Clear selection
        </button>
      </div>
      <div className="admin-events-bulk-bar-actions">
        <button
          type="button"
          className="admin-series-action"
          disabled={!cancellable.length}
          onClick={() => setMode("cancel")}
        >
          Cancel ({cancellable.length})
        </button>
        <button
          type="button"
          className="admin-series-action"
          disabled={!archivable.length}
          onClick={() => setMode("archive")}
        >
          Archive cancelled ({archivable.length})
        </button>
        <button
          type="button"
          className="admin-series-action admin-series-action-subordinate"
          onClick={() => setMode("lean-delete")}
        >
          Delete permanently
        </button>
      </div>

      <PeopleDestructiveActionSheet
        open={mode !== null}
        onClose={() => setMode(null)}
        kicker="Events"
        title={
          mode === "cancel"
            ? "Cancel selected events."
            : mode === "archive"
              ? "Archive cancelled events."
              : "Delete lean events permanently."
        }
      >
        {mode === "cancel" ? (
          <>
            <p>
              Permanently cancel {cancellable.length} event
              {cancellable.length === 1 ? "" : "s"}. History is preserved. This cannot be undone.
            </p>
            <form action={cancelAction} className="ops-people-profile-archive">
              {cancellable.map((event) => (
                <input key={event.id} type="hidden" name="eventIds" value={event.id} />
              ))}
              <label className="ops-people-profile-archive-reason">
                <span className="ops-label">Cancellation reason</span>
                <input
                  name="reason"
                  required
                  maxLength={500}
                  defaultValue="Bulk cancelled by System Admin"
                  aria-label="Cancellation reason"
                />
              </label>
              <ConfirmSubmit
                variant="destructive"
                message={`Cancel ${cancellable.length} event${cancellable.length === 1 ? "" : "s"} permanently?`}
              >
                Cancel selected
              </ConfirmSubmit>
            </form>
          </>
        ) : null}
        {mode === "archive" ? (
          <>
            <p>
              Archive {archivable.length} cancelled event
              {archivable.length === 1 ? "" : "s"}. Registrations and history remain available under
              View archived events.
            </p>
            <form action={archiveAction} className="ops-people-profile-archive">
              {archivable.map((event) => (
                <input key={event.id} type="hidden" name="eventIds" value={event.id} />
              ))}
              <ConfirmSubmit message={`Archive ${archivable.length} cancelled event${archivable.length === 1 ? "" : "s"}?`}>
                Archive selected
              </ConfirmSubmit>
            </form>
          </>
        ) : null}
        {mode === "lean-delete" ? (
          <>
            <p>
              Permanently delete only lean junk/test events with no registrations or durable
              history. Events with history must be cancelled and archived instead. This cannot be
              undone.
            </p>
            <form action={deleteAction} className="ops-people-profile-archive">
              {selectedIds.map((id) => (
                <input key={id} type="hidden" name="eventIds" value={id} />
              ))}
              <label className="ops-people-profile-archive-reason">
                <span className="ops-label">Reason for permanent delete</span>
                <input
                  name="reason"
                  required
                  maxLength={500}
                  placeholder="Why permanently delete these lean events?"
                  aria-label="Reason for permanent delete"
                />
              </label>
              <ConfirmSubmit
                variant="destructive"
                message={`Permanently delete ${selectedIds.length} lean event${selectedIds.length === 1 ? "" : "s"}? Rows with history will be refused.`}
              >
                Delete permanently
              </ConfirmSubmit>
            </form>
          </>
        ) : null}
        {activeState?.error ? (
          <p role="alert" className="ops-people-profile-message is-error">
            {activeState.error}
          </p>
        ) : null}
        {activeState?.success ? (
          <p role="status" className="ops-people-profile-message">
            {activeState.success}
          </p>
        ) : null}
      </PeopleDestructiveActionSheet>
    </div>
  );
}
