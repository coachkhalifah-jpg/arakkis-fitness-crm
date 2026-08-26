"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type PeopleRecord = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  organization: string;
  registered: string;
  attendance: string;
  booking: string;
  event: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length === 10) {
    return `+1 ${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
  }
  return phone;
}

export function PeopleDirectory({
  query,
  people,
  error,
}: {
  query: string;
  people: PeopleRecord[];
  error?: string;
}) {
  const router = useRouter();
  const [input, setInput] = useState(query);
  const [notice, setNotice] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const selectedPerson = useMemo(
    () => people.find((person) => person.id === detailId),
    [detailId, people],
  );

  useEffect(() => {
    if (!selectedPerson) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailId(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedPerson]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = input.trim();
    setNotice("");
    setDetailId(null);
    if (nextQuery.length < 2) {
      setNotice("Enter at least two characters to search by name, phone, or email.");
      return;
    }
    startSearch(() => {
      router.push(`/admin/participants?q=${encodeURIComponent(nextQuery)}`);
    });
  }

  const hasQuery = query.length >= 2;
  const searchError = error ? "Search is temporarily unavailable. Try again in a moment." : "";

  return (
    <>
      <main className="people-directory-page">
        <header className="people-directory-header">
          <div>
            <p className="people-directory-kicker">Operations directory</p>
            <h1>People</h1>
            <p className="people-directory-lede">
              Find someone quickly, then see the Event context that matters for today’s work.
            </p>
          </div>
          <div className="people-directory-scope" aria-label="People directory scope">
            <span>System Admin</span>
            <strong>All organizations</strong>
          </div>
        </header>

        <section className="people-directory-search" aria-labelledby="people-search-title">
          <div className="people-directory-section-heading">
            <div>
              <p className="people-directory-kicker">Search the directory</p>
              <h2 id="people-search-title">
                Who are you
                <br />
                looking for?
              </h2>
            </div>
            <a
              className="people-directory-export"
              href={
                hasQuery ? `/admin/participants/export?q=${encodeURIComponent(query)}` : undefined
              }
              aria-disabled={!hasQuery}
              onClick={(event) => {
                if (!hasQuery) event.preventDefault();
              }}
            >
              Export People <span>.csv</span> <b aria-hidden="true">↗</b>
            </a>
          </div>
          <form className="people-directory-form" onSubmit={submit}>
            <label htmlFor="people-query">Name, phone, or email</label>
            <div className="people-directory-input-row">
              <input
                id="people-query"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Name, phone, or email"
                autoComplete="off"
              />
              <button type="submit" disabled={isSearching}>
                {isSearching ? "Searching…" : "Search"}
              </button>
            </div>
            <p className="people-directory-hint">
              Use at least two characters. Results stay within your authorized Organization scope.
            </p>
          </form>
        </section>

        {notice ? (
          <p className="people-directory-feedback" role="status">
            {notice}
          </p>
        ) : null}
        <section className="people-directory-results" aria-live="polite">
          <div className="people-directory-section-heading">
            <div>
              <p className="people-directory-kicker">Directory results</p>
              <h2>
                {hasQuery
                  ? `${people.length} ${people.length === 1 ? "match" : "matches"}`
                  : "Search to begin"}
              </h2>
            </div>
            {hasQuery ? <span className="people-directory-query">“{query}”</span> : null}
          </div>

          {searchError ? (
            <div className="people-directory-empty" role="alert">
              <strong>We couldn’t search right now.</strong>
              <p>{searchError}</p>
            </div>
          ) : isSearching ? (
            <div className="people-directory-loading" role="status">
              <span aria-hidden="true" /> Searching the authorized directory…
            </div>
          ) : hasQuery && !people.length ? (
            <div className="people-directory-empty">
              <strong>No one matched that search.</strong>
              <p>
                Try a different name, phone number, or email. Private Organization records remain
                scoped.
              </p>
            </div>
          ) : !hasQuery ? (
            <div className="people-directory-empty">
              <strong>Search by name, phone, or email.</strong>
              <p>Start with two characters to find a person and their relevant Event context.</p>
            </div>
          ) : (
            <div className="people-directory-list">
              {people.map((person) => (
                <button
                  type="button"
                  className="people-directory-row"
                  key={person.id}
                  onClick={() => setDetailId(person.id)}
                >
                  <span className="people-directory-initials" aria-hidden="true">
                    {initials(person.name)}
                  </span>
                  <span className="people-directory-main">
                    <strong>{person.name}</strong>
                    <span>
                      {person.phone} · {person.email ?? "No email"}
                    </span>
                    <span className="people-directory-context">
                      {person.organization} · {person.booking}
                    </span>
                  </span>
                  <span className="people-directory-arrow" aria-hidden="true">
                    ↗
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      {selectedPerson ? (
        <div
          className="people-directory-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDetailId(null);
          }}
        >
          <aside
            className="people-directory-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="people-detail-title"
          >
            <button
              type="button"
              className="people-directory-close"
              onClick={() => setDetailId(null)}
              aria-label="Close People details"
            >
              Close ×
            </button>
            <p className="people-directory-kicker">People detail</p>
            <h2 id="people-detail-title">{selectedPerson.name}</h2>
            <p className="people-directory-sheet-scope">
              {selectedPerson.organization} · {selectedPerson.registered}
            </p>
            <div className="people-directory-detail-block people-directory-contact">
              <span>Contact</span>
              <a href={`tel:${selectedPerson.phone.replace(/[^+\d]/g, "")}`}>
                {formatPhone(selectedPerson.phone)}
              </a>
              {selectedPerson.email ? (
                <a href={`mailto:${selectedPerson.email}`}>{selectedPerson.email}</a>
              ) : null}
            </div>
            <div className="people-directory-detail-block people-directory-upcoming">
              <span>Upcoming booking</span>
              <strong>{selectedPerson.booking}</strong>
            </div>
            <div className="people-directory-detail-block">
              <span>Participation context</span>
              <strong>{selectedPerson.attendance}</strong>
              <small>Most recent Event: {selectedPerson.event}</small>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
