import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Published event capacity edit (DEC-009 / FR-005)", () => {
  const migration = readFileSync(
    join(root, "supabase/migrations/0085_allow_published_event_capacity_edit.sql"),
    "utf8",
  );
  const actions = readFileSync(join(root, "src/lib/services/phase-3-actions.ts"), "utf8");
  const sqlTest = readFileSync(
    join(root, "supabase/tests/phase-16-published-capacity-edit.sql"),
    "utf8",
  );

  it("removes capacity from published-field immutability in migration 0085", () => {
    expect(migration).toContain("enforce_event_phase_3_guards");
    expect(migration).toContain("new.capacity <> old.capacity");
    expect(migration).toMatch(/remove capacity|Capacity may change after publish/i);
  });

  it("maps capacity floor and remaining schedule-immutability errors clearly", () => {
    expect(actions).toContain("Capacity cannot be below the number of active registrations.");
    expect(actions).toContain(
      "Schedule, venue, and ownership cannot be changed after this event is published.",
    );
  });

  it("keeps a SQL catalog assertion for the guard rewrite", () => {
    expect(sqlTest).toContain("new.capacity <> old.capacity");
    expect(sqlTest).toContain("enforce_event_phase_3_guards");
  });
});
