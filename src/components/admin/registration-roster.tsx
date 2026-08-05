"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { saveAttendanceChanges } from "@/lib/services/phase-5-actions";
import type { Phase3ActionState } from "@/lib/services/phase-3-actions";
import { SubmitButton } from "@/components/admin/submit-button";

export type RegistrationRosterRow = {
  id: string;
  participantName: string;
  phone: string;
  email: string;
  registrationStatus: string;
  attendanceStatus: string;
  registeredAt: string;
  firstClass: boolean;
};

const initialState: Phase3ActionState = {};

export function RegistrationRoster({
  eventId,
  rows,
  canEdit,
  requiresReason,
}: {
  eventId: string;
  rows: RegistrationRosterRow[];
  canEdit: boolean;
  requiresReason: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const submit = async (_state: Phase3ActionState, formData: FormData) => {
    const result = await saveAttendanceChanges(_state, formData);
    if (result.success) setDraft({});
    return result;
  };
  const [state, action, pending] = useActionState(submit, initialState);
  const persisted = useMemo(
    () => new Map(rows.map((row) => [row.id, row.attendanceStatus])),
    [rows],
  );
  const changed = rows.filter(
    (row) => draft[row.id] !== undefined && draft[row.id] !== row.attendanceStatus,
  );
  const toggle = (row: RegistrationRosterRow) => {
    setDraft((current) => {
      const currentStatus = current[row.id] ?? row.attendanceStatus;
      return {
        ...current,
        [row.id]: currentStatus === "ATTENDED" ? "NOT_RECORDED" : "ATTENDED",
      };
    });
  };

  return (
    <form action={action}>
      <input type="hidden" name="eventId" value={eventId} />
      <input
        type="hidden"
        name="changes"
        value={JSON.stringify(
          changed.map((row) => ({
            registration_id: row.id,
            status: draft[row.id],
            ...(requiresReason ? { reason: reason.trim() } : {}),
          })),
        )}
      />
      {changed.length ? (
        <p className="mt-3 text-sm font-medium text-amber-800" role="status">
          {changed.length} unsaved attendance change{changed.length === 1 ? "" : "s"}
        </p>
      ) : null}
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Participant</th>
              <th className="p-2">Phone</th>
              <th className="p-2">Email</th>
              <th className="p-2">Status</th>
              <th className="p-2">Attendance</th>
              {canEdit ? <th className="p-2">Check-in</th> : null}
              <th className="p-2">Registered</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const status = draft[row.id] ?? persisted.get(row.id) ?? row.attendanceStatus;
              const disabled = row.registrationStatus === "CANCELLED";
              return (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="p-2">
                    <span className="inline-flex items-center gap-2">
                      {row.participantName}
                      {row.firstClass ? (
                        <span className="rounded-full bg-coral/10 px-2 py-1 text-xs font-bold text-coral">
                          First Class
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="p-2">{row.phone || "—"}</td>
                  <td className="p-2">{row.email || "—"}</td>
                  <td className="p-2">{row.registrationStatus}</td>
                  <td className="p-2">{status}</td>
                  {canEdit ? (
                    <td className="p-2">
                      <button
                        type="button"
                        aria-pressed={status === "ATTENDED"}
                        aria-label={status === "ATTENDED" ? "Checked in" : "Check in"}
                        disabled={disabled}
                        onClick={() => toggle(row)}
                        className="rounded-full border border-brand px-3 py-1 font-semibold text-brand disabled:opacity-50"
                      >
                        {status === "ATTENDED" ? "Checked in" : "Check in"}
                      </button>
                    </td>
                  ) : null}
                  <td className="p-2">{row.registeredAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canEdit ? (
        <div className="mt-5">
          {requiresReason ? (
            <label className="mb-3 block text-sm">
              Correction reason
              <input
                name="correctionReason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required={Boolean(changed.length)}
                className="mt-1 w-full rounded border p-2"
                placeholder="Why is this finalized attendance being corrected?"
              />
            </label>
          ) : null}
          <SubmitButton disabled={!changed.length || pending}>Save Attendance Changes</SubmitButton>
        </div>
      ) : null}
      {state.error ? (
        <div role="alert" className="mt-3 text-sm text-red-700">
          <p>{state.error}</p>
          {state.errorAction ? <p className="mt-1 font-medium">Next: {state.errorAction}</p> : null}
        </div>
      ) : null}
      {state.success ? (
        <p role="status" className="mt-3 text-sm text-green-700">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
