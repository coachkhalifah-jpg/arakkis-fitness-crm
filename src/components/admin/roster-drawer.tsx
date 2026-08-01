"use client";

import { useState } from "react";
import { X } from "lucide-react";

type RosterPerson = {
  id: string;
  name: string;
  phone: string | null;
  attended: boolean;
  firstClass: boolean;
};

export function RosterDrawer({
  eventName,
  people,
  canViewPhone,
  fullRosterHref,
}: {
  eventName: string;
  people: RosterPerson[];
  canViewPhone: boolean;
  fullRosterHref: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="admin-secondary-button" onClick={() => setOpen(true)}>
        View Roster
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label={`${eventName} roster`}
        >
          <button
            type="button"
            className="absolute inset-0 bg-ink/30"
            aria-label="Close roster"
            onClick={() => setOpen(false)}
          />
          <aside className="admin-roster-sheet absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="admin-eyebrow">Quick roster</p>
                <h2 className="mt-1 text-2xl font-semibold">{eventName}</h2>
              </div>
              <button
                type="button"
                className="admin-icon-button"
                aria-label="Close roster"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <ol className="mt-6 divide-y divide-admin-border" aria-label="Participants">
              {people.map((person) => (
                <li key={person.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">
                      {person.name}
                      {person.firstClass ? (
                        <span className="first-class-badge ml-2">First Class</span>
                      ) : null}
                    </p>
                    {canViewPhone && person.phone ? (
                      <a
                        className="text-sm text-admin-text-muted underline"
                        href={`tel:${person.phone}`}
                        aria-label={`Call ${person.name}`}
                      >
                        {person.phone}
                      </a>
                    ) : null}
                  </div>
                  <span
                    className={`text-xs font-semibold ${person.attended ? "text-admin-success" : "text-admin-text-muted"}`}
                  >
                    {person.attended ? "Checked in" : "Not checked in"}
                  </span>
                </li>
              ))}
            </ol>
            <a className="admin-secondary-button mt-6 block text-center" href={fullRosterHref}>
              Open Full Roster
            </a>
          </aside>
        </div>
      ) : null}
    </>
  );
}
