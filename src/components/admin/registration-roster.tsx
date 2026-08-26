"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import { saveAttendanceChanges } from "@/lib/services/phase-5-actions";
import type { Phase3ActionState } from "@/lib/services/phase-3-actions";
import { SubmitButton } from "@/components/admin/submit-button";
import { RemoveRosterAction } from "@/components/admin/remove-roster-action";
import { attendancePresentation } from "@/lib/services/attendance-presentation";

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

const rosterFilters = [
  { key: "REGISTERED", label: "Registered" },
  { key: "ATTENDED", label: "Checked in" },
  { key: "NO_SHOW", label: "No-show" },
  { key: "CANCELLED", label: "Cancelled" },
] as const;

function registrationLabel(status: string) {
  if (status === "REGISTERED") return "Registered";
  if (status === "CANCELLED") return "Cancelled";
  if (status === "WAITLISTED") return "Waitlisted";
  return status.replaceAll("_", " ");
}

export function RegistrationRoster({
  eventId,
  eventName,
  rows,
  canViewPhone,
  canEdit,
  requiresReason,
  context,
  checkInAction,
  removeRegistrationAction,
  canRemoveRegistration = false,
}: {
  eventId: string;
  eventName: string;
  rows: RegistrationRosterRow[];
  canViewPhone: boolean;
  canEdit: boolean;
  requiresReason: boolean;
  context?: {
    dateTime: string;
    venue: string;
    attendanceState: string;
    registered: number;
    checkedIn: number;
    capacity: number;
  };
  checkInAction?: (formData: FormData) => Promise<void>;
  removeRegistrationAction?: (
    state: Phase3ActionState,
    formData: FormData,
  ) => Promise<Phase3ActionState>;
  canRemoveRegistration?: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [query, setQuery] = useState("");
  const [rosterFilter, setRosterFilter] =
    useState<(typeof rosterFilters)[number]["key"]>("REGISTERED");
  const errorRef = useRef<HTMLDivElement>(null);
  const submit = async (_state: Phase3ActionState, formData: FormData) => {
    const result = await saveAttendanceChanges(_state, formData);
    if (result.success) setDraft({});
    return result;
  };
  const [state, action, pending] = useActionState(submit, initialState);
  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state.error]);
  const persisted = useMemo(
    () => new Map(rows.map((row) => [row.id, row.attendanceStatus])),
    [rows],
  );
  const changed = rows.filter(
    (row) => draft[row.id] !== undefined && draft[row.id] !== row.attendanceStatus,
  );
  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesFilter =
        rosterFilter === "REGISTERED"
          ? row.registrationStatus === "REGISTERED"
          : rosterFilter === "CANCELLED"
            ? row.registrationStatus === "CANCELLED"
            : row.attendanceStatus === rosterFilter;
      const matchesQuery =
        !normalized ||
        [row.participantName, row.phone, row.email, row.registrationStatus]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [query, rosterFilter, rows]);
  const toggle = (row: RegistrationRosterRow) => {
    setDraft((current) => {
      const currentStatus = current[row.id] ?? row.attendanceStatus;
      return {
        ...current,
        [row.id]: currentStatus === "ATTENDED" ? "NOT_RECORDED" : "ATTENDED",
      };
    });
  };

  const renderCheckIn = (row: RegistrationRosterRow, status: string) => {
    const disabled = row.registrationStatus === "CANCELLED";
    const presentation = attendancePresentation(status, context?.attendanceState ?? "OPEN");
    if (status === "ATTENDED") {
      return (
        <span className="event-roster-check-in-state" role="status">
          IN
          <span aria-hidden="true">✓</span>
        </span>
      );
    }
    if (!canEdit || disabled) {
      return <span className="event-roster-status-text">{presentation.label}</span>;
    }
    if (requiresReason || !checkInAction) {
      return (
        <button
          type="button"
          className="event-roster-check-in-button"
          aria-pressed={status === "ATTENDED"}
          onClick={() => toggle(row)}
        >
          Check in
        </button>
      );
    }
    return (
      <form action={checkInAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="registrationId" value={row.id} />
        <input type="hidden" name="status" value="ATTENDED" />
        <button type="submit" className="event-roster-check-in-button">
          Check in
        </button>
      </form>
    );
  };

  const renderSecondaryAction = (row: RegistrationRosterRow) =>
    canRemoveRegistration && removeRegistrationAction ? (
      <RemoveRosterAction
        action={removeRegistrationAction}
        eventId={eventId}
        eventName={eventName}
        registrationId={row.id}
        participantName={row.participantName}
      />
    ) : null;

  return (
    <div className="event-roster-workspace">
      {context ? (
        <section className="event-roster-context" aria-label="Event context">
          <div>
            <p className="event-roster-context-eyebrow">Event context</p>
            <h3>{eventName}</h3>
            <p>
              {context.dateTime} · {context.venue}
            </p>
          </div>
          <div className="event-roster-context-status">
            <span>{context.attendanceState}</span>
            <span>
              {context.registered} registered · {context.checkedIn} checked in · {context.capacity}{" "}
              capacity
            </span>
          </div>
        </section>
      ) : null}
      <div className="event-roster-search-row">
        <label className="event-roster-search-label" htmlFor={`roster-search-${eventId}`}>
          Search participant
        </label>
        <input
          id={`roster-search-${eventId}`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, phone, or email"
          className="event-roster-search"
        />
      </div>
      <div className="event-roster-filters" role="group" aria-label="Roster filters">
        {rosterFilters.map((filter) => {
          const count = rows.filter((row) =>
            filter.key === "REGISTERED"
              ? row.registrationStatus === "REGISTERED"
              : filter.key === "CANCELLED"
                ? row.registrationStatus === "CANCELLED"
                : row.attendanceStatus === filter.key,
          ).length;
          return (
            <button
              key={filter.key}
              type="button"
              className={`event-roster-filter ${rosterFilter === filter.key ? "is-selected" : ""}`}
              aria-pressed={rosterFilter === filter.key}
              onClick={() => setRosterFilter(filter.key)}
            >
              <span>{filter.label}</span>
              <strong>{count}</strong>
            </button>
          );
        })}
      </div>
      {changed.length ? (
        <p className="mt-3 text-sm font-medium text-amber-800" role="status">
          {changed.length} unsaved attendance change{changed.length === 1 ? "" : "s"}
        </p>
      ) : null}
      <form action={action} id={`attendance-changes-${eventId}`}>
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
        {requiresReason ? (
          <label className="event-roster-reason">
            Correction reason
            <input
              name="correctionReason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required={Boolean(changed.length)}
              placeholder="Why is this finalized attendance being corrected?"
            />
          </label>
        ) : null}
        {canEdit ? (
          <SubmitButton disabled={!changed.length || pending}>Save Attendance Changes</SubmitButton>
        ) : null}
      </form>
      <div className="event-roster-table event-roster-desktop">
        <table className="event-roster-grid text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Participant</th>
              <th className="p-2">Phone</th>
              <th className="p-2">Email</th>
              <th className="p-2">Status</th>
              <th className="p-2">Attendance</th>
              <th className="p-2">Check-in</th>
              <th className="p-2">Registered</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const status = draft[row.id] ?? persisted.get(row.id) ?? row.attendanceStatus;
              return (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="p-2">
                    <span className="inline-flex items-center gap-2">
                      {row.participantName}
                      {row.firstClass ? (
                        <span className="first-class-badge ml-2">First Class</span>
                      ) : null}
                    </span>
                  </td>
                  <td className="p-2">{row.phone || "—"}</td>
                  <td className="p-2">{row.email || "—"}</td>
                  <td className="p-2">{registrationLabel(row.registrationStatus)}</td>
                  <td className="p-2">
                    {attendancePresentation(status, context?.attendanceState ?? "OPEN").label}
                  </td>
                  <td className="p-2">{renderCheckIn(row, status)}</td>
                  <td className="p-2">{row.registeredAt}</td>
                  <td className="p-2">{renderSecondaryAction(row)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visibleRows.length ? (
          <p className="event-roster-empty">No participants match this search.</p>
        ) : null}
      </div>
      <div className="event-roster-mobile" aria-label="Mobile registration roster">
        {visibleRows.length ? (
          visibleRows.map((row) => {
            const status = draft[row.id] ?? persisted.get(row.id) ?? row.attendanceStatus;
            return (
              <article key={row.id} className="event-roster-mobile-record">
                <div className="event-roster-person">
                  <h3>{row.participantName}</h3>
                  <div className="event-roster-meta">
                    {row.firstClass ? <span className="first-class-badge">First Class</span> : null}
                    <span>{registrationLabel(row.registrationStatus)}</span>
                    {canViewPhone && row.phone ? (
                      <a href={`tel:${row.phone}`}>{row.phone}</a>
                    ) : null}
                    <span>{row.email || "No email available"}</span>
                  </div>
                </div>
                <div className="event-roster-mobile-actions">
                  {renderCheckIn(row, status)}
                  {renderSecondaryAction(row)}
                </div>
              </article>
            );
          })
        ) : (
          <p className="event-roster-empty">No participants match this search.</p>
        )}
      </div>
      {state.error ? (
        <div ref={errorRef} tabIndex={-1} role="alert" className="mt-3 text-sm text-red-700">
          <p>{state.error}</p>
          {state.errorAction ? <p className="mt-1 font-medium">Next: {state.errorAction}</p> : null}
        </div>
      ) : null}
      {state.success ? (
        <p role="status" className="mt-3 text-sm text-green-700">
          {state.success}
        </p>
      ) : null}
    </div>
  );
}
