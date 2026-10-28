export type EventWaitlistEntry = {
  id: string;
  displayName: string;
  contact: string;
  joinedAt: string;
};

export function EventWaitlistPanel({
  entries,
  count,
}: {
  entries: EventWaitlistEntry[];
  count: number;
}) {
  return (
    <section className="admin-waitlist-panel" aria-labelledby="manage-event-waitlist-title">
      <div className="admin-waitlist-panel-heading">
        <div>
          <p className="admin-waitlist-panel-kicker">Demand waitlist · {count} / 5</p>
          <h3 id="manage-event-waitlist-title">Interest list</h3>
        </div>
        <p className="admin-waitlist-panel-note">
          Observation only — entries do not reserve seats or count toward capacity.
        </p>
      </div>
      {entries.length ? (
        <ol className="admin-waitlist-list">
          {entries.map((entry, index) => (
            <li key={entry.id}>
              <span className="admin-waitlist-rank" aria-hidden="true">
                {index + 1}
              </span>
              <span>
                <strong>{entry.displayName}</strong>
                <small>{entry.contact}</small>
              </span>
              <time dateTime={entry.joinedAt}>{entry.joinedAt}</time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="admin-waitlist-empty">No waitlist interest for this occurrence yet.</p>
      )}
    </section>
  );
}
