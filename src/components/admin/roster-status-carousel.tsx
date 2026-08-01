"use client";

import { useState } from "react";
import { X } from "lucide-react";

export type RosterPreviewPerson = {
  id: string;
  name: string;
  phone: string | null;
  registrationStatus: string;
  attendanceStatus: string;
  firstClass: boolean;
};

const groups = [
  { key: "registered", label: "Registered", description: "Active reservations" },
  { key: "attended", label: "Attended", description: "Checked-in participants" },
  { key: "no-show", label: "No-show", description: "Finalized no-shows" },
  { key: "cancelled", label: "Cancelled", description: "Cancelled reservations" },
] as const;

function matches(key: (typeof groups)[number]["key"], person: RosterPreviewPerson) {
  if (key === "registered") return person.registrationStatus === "REGISTERED";
  if (key === "cancelled") return person.registrationStatus === "CANCELLED";
  if (key === "attended") return person.attendanceStatus === "ATTENDED";
  return person.attendanceStatus === "NO_SHOW";
}

export function RosterStatusCarousel({ people }: { people: RosterPreviewPerson[] }) {
  const [selected, setSelected] = useState("registered");
  const [open, setOpen] = useState(false);
  const current = groups.find((group) => group.key === selected) ?? groups[0];
  const filtered = people.filter((person) => matches(current.key, person));

  return (
    <section
      className="admin-surface mt-8 rounded-3xl p-5 sm:p-6"
      aria-labelledby="roster-summary-title"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="admin-eyebrow">Progressive view</p>
          <h2 id="roster-summary-title" className="mt-1 text-2xl font-semibold">
            Roster groups
          </h2>
        </div>
        <span className="text-sm text-admin-text-muted">Select a group to inspect</span>
      </div>
      <div
        className="roster-carousel mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
        role="tablist"
        aria-label="Roster groups"
      >
        {groups.map((group) => {
          const count = people.filter((person) => matches(group.key, person)).length;
          const isSelected = group.key === selected;
          return (
            <button
              key={group.key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`roster-summary-card min-w-[12.5rem] snap-start text-left ${isSelected ? "roster-summary-card-selected" : ""}`}
              onClick={() => {
                setSelected(group.key);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setOpen(true);
              }}
            >
              <span className="block text-sm font-semibold">{group.label}</span>
              <strong className="mt-2 block text-4xl tracking-[-0.05em]">{count}</strong>
              <span className="mt-1 block text-xs text-admin-text-muted">{group.description}</span>
            </button>
          );
        })}
      </div>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="roster-dialog-title"
        >
          <div className="admin-roster-dialog max-h-[88svh] w-full max-w-3xl overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:rounded-[2rem]">
            <div className="flex items-start justify-between gap-4 border-b border-admin-border p-5 sm:p-6">
              <div>
                <p className="admin-eyebrow">Selected group</p>
                <h3 id="roster-dialog-title" className="mt-1 text-2xl font-semibold">
                  {current.label}
                </h3>
                <p className="mt-1 text-sm text-admin-text-muted">{filtered.length} participants</p>
              </div>
              <button
                type="button"
                className="admin-icon-button"
                onClick={() => setOpen(false)}
                aria-label="Close roster group"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="max-h-[calc(88svh-8rem)] overflow-auto p-5 sm:p-6">
              {filtered.length ? (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-admin-border">
                      <th className="p-3 pl-0">Participant</th>
                      <th className="p-3">Attendance</th>
                      <th className="p-3 pr-0">Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((person) => (
                      <tr key={person.id} className="border-b border-admin-border last:border-0">
                        <td className="p-3 pl-0 font-semibold">
                          {person.name}
                          {person.firstClass ? (
                            <span className="first-class-badge ml-2">First Class</span>
                          ) : null}
                        </td>
                        <td className="p-3">{person.attendanceStatus.replaceAll("_", " ")}</td>
                        <td className="p-3 pr-0">{person.phone ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="rounded-2xl bg-admin-surface-muted p-5 text-sm text-admin-text-muted">
                  No participants currently match this group.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
