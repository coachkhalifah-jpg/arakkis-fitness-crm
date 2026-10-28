export type SeriesWaitlistRollupRow = {
  eventId: string;
  startsAt: string;
  label: string;
  waitlistCount: number;
  capacity: number;
  registered: number;
};

export function SeriesWaitlistRollup({ rows }: { rows: SeriesWaitlistRollupRow[] }) {
  if (!rows.length) return null;
  const total = rows.reduce((sum, row) => sum + row.waitlistCount, 0);
  return (
    <section
      className="admin-series-waitlist-rollup"
      aria-labelledby="series-waitlist-rollup-title"
    >
      <div className="admin-series-waitlist-rollup-heading">
        <h3 id="series-waitlist-rollup-title">Series waitlist interest</h3>
        <p>
          Display-only rollup across occurrences · {total} total
          {total === 1 ? " entry" : " entries"}
        </p>
      </div>
      <ul className="admin-series-waitlist-rollup-strip">
        {rows.map((row) => (
          <li key={row.eventId} className={row.waitlistCount > 0 ? "has-interest" : undefined}>
            <span className="admin-series-waitlist-date">{row.label}</span>
            <strong>
              {row.waitlistCount}
              <span className="sr-only"> on waitlist</span>
            </strong>
            <span className="admin-series-waitlist-capacity">
              {row.registered}/{row.capacity}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
