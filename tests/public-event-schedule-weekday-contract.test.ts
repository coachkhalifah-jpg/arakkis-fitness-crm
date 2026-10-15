import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DEC-068 public_event_schedule one card per series weekday", () => {
  it("partitions upcoming occurrences by series and venue-local ISO weekday", () => {
    const migration = readFileSync(
      "supabase/migrations/0080_public_event_schedule_one_per_weekday.sql",
      "utf8",
    );
    expect(migration).toContain("public_event_schedule");
    expect(migration).toContain("extract(isodow from (e.starts_at at time zone e.timezone))");
    expect(migration).toContain("occurrence_rank = 1");
    expect(migration).toContain("coalesce(e.event_series_id, e.id)");
  });
});
