import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DEC-065 materialize trusts canonical template", () => {
  it("0079 removes the sibling conflicting-defaults hard-stop", () => {
    const migration = readFileSync(
      "supabase/migrations/0079_materialize_trust_canonical_template.sql",
      "utf8",
    );
    expect(migration).toContain("phase3_materialize_schedule_rule");
    expect(migration).toContain("canonical earliest");
    expect(migration).not.toContain("series occurrences contain conflicting default values");
  });
});
