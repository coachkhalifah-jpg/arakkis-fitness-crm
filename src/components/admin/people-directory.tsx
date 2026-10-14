"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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

function peopleHref(query: string, page: number) {
  const params = new URLSearchParams();
  if (query.length >= 2) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/participants?${qs}` : "/admin/participants";
}

export function PeopleDirectory({
  query,
  people,
  page,
  totalPages,
  totalCount,
  error,
}: {
  query: string;
  people: PeopleRecord[];
  page: number;
  totalPages: number;
  totalCount: number;
  error?: string;
}) {
  const router = useRouter();
  const [input, setInput] = useState(query);
  const [notice, setNotice] = useState("");
  const [isSearching, startSearch] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = input.trim();
    setNotice("");
    if (nextQuery.length === 1) {
      setNotice("Enter at least two characters to search by name, phone, or email.");
      return;
    }
    startSearch(() => {
      router.push(peopleHref(nextQuery, 1));
    });
  }

  const hasQuery = query.length >= 2;
  const searchError = error
    ? "The directory is temporarily unavailable. Try again in a moment."
    : "";
  const resultHeading = hasQuery
    ? `${totalCount} ${totalCount === 1 ? "match" : "matches"}`
    : totalCount
      ? `${totalCount} ${totalCount === 1 ? "person" : "people"}`
      : "Directory";

  return (
    <main className="people-directory-page">
      <header className="people-directory-header">
        <div>
          <p className="people-directory-kicker">Operations directory</p>
          <h1>People</h1>
          <p className="people-directory-lede">
            Browse the directory or search, then open a full profile for today’s work.
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
            Leave blank to browse everyone, or use at least two characters to filter. Results stay
            within your authorized Organization scope.
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
            <h2>{resultHeading}</h2>
          </div>
          {hasQuery ? <span className="people-directory-query">“{query}”</span> : null}
        </div>

        {searchError ? (
          <div className="people-directory-empty" role="alert">
            <strong>We couldn’t load the directory right now.</strong>
            <p>{searchError}</p>
          </div>
        ) : isSearching ? (
          <div className="people-directory-loading" role="status">
            <span aria-hidden="true" /> Loading the authorized directory…
          </div>
        ) : !people.length ? (
          <div className="people-directory-empty">
            <strong>
              {hasQuery ? "No one matched that search." : "No people in the directory yet."}
            </strong>
            <p>
              {hasQuery
                ? "Try a different name, phone number, or email. Private Organization records remain scoped."
                : "People appear here after they register for an Event."}
            </p>
          </div>
        ) : (
          <>
            <div className="people-directory-list">
              {people.map((person) => (
                <Link
                  className="people-directory-row"
                  key={person.id}
                  href={`/admin/participants/${person.id}`}
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
                </Link>
              ))}
            </div>
            {totalPages > 1 ? (
              <nav
                className="ops-org-pagination people-directory-pagination"
                aria-label="People pages"
              >
                {page > 1 ? (
                  <Link
                    className="ops-org-pagination-button"
                    href={peopleHref(query, page - 1)}
                    scroll={false}
                    aria-label="Previous people page"
                  >
                    <span className="arakkis-arrow-icon" aria-hidden="true">
                      ←
                    </span>
                  </Link>
                ) : (
                  <span className="ops-org-pagination-button is-disabled" aria-hidden="true">
                    <span className="arakkis-arrow-icon">←</span>
                  </span>
                )}
                <span className="ops-org-pagination-label">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages ? (
                  <Link
                    className="ops-org-pagination-button"
                    href={peopleHref(query, page + 1)}
                    scroll={false}
                    aria-label="Next people page"
                  >
                    <span className="arakkis-arrow-icon" aria-hidden="true">
                      →
                    </span>
                  </Link>
                ) : (
                  <span className="ops-org-pagination-button is-disabled" aria-hidden="true">
                    <span className="arakkis-arrow-icon">→</span>
                  </span>
                )}
              </nav>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
