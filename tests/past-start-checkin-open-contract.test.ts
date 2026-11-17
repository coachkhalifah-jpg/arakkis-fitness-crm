import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mapAttendanceError } from "@/lib/services/attendance-errors";

const root = process.cwd();

describe("Past-start check-in open (phase-3 guard transition-only)", () => {
  const migration = readFileSync(
    join(root, "supabase/migrations/0092_phase3_open_guard_transition_only.sql"),
    "utf8",
  );
  const sqlTest = readFileSync(
    join(root, "supabase/tests/phase-17-past-start-attendance-open.sql"),
    "utf8",
  );
  const prior = readFileSync(
    join(root, "supabase/migrations/0087_published_event_capacity_edit_replace.sql"),
    "utf8",
  );

  it("replaces enforce_event_phase_3_guards with transition-only past-start check", () => {
    expect(migration).toContain("create or replace function public.enforce_event_phase_3_guards");
    expect(migration).toContain("tg_op = 'INSERT'");
    expect(migration).toContain("old.status is distinct from new.status");
    expect(migration).toContain(
      "event cannot be opened with an invalid registration deadline or past start",
    );
    // Must not keep the unconditional "while status = OPEN" form from 0087.
    expect(migration).not.toMatch(
      /if new\.status = 'OPEN' and \(new\.registration_deadline > new\.starts_at or new\.starts_at <= now\(\)\)/,
    );
  });

  it("preserves published schedule immutability and capacity editability from 0087", () => {
    expect(migration).toContain("registration_deadline is distinct from old.registration_deadline");
    expect(migration).not.toMatch(/new\.capacity\s+is distinct from\s+old\.capacity/);
    expect(prior).toMatch(
      /if new\.status = 'OPEN' and \(new\.registration_deadline > new\.starts_at or new\.starts_at <= now\(\)\)/,
    );
  });

  it("keeps a SQL catalog assertion for the transition-only rewrite", () => {
    expect(sqlTest).toContain("enforce_event_phase_3_guards");
    expect(sqlTest).toContain("old.status is distinct from new.status");
    expect(sqlTest).toContain("tg_op = ''INSERT''");
  });

  it("maps publish past-start guard distinctly from generic attendance not-open", () => {
    const mapped = mapAttendanceError(
      new Error("event cannot be opened with an invalid registration deadline or past start"),
    );
    expect(mapped.code).toBe("ATTENDANCE_NOT_OPEN");
    expect(mapped.message).not.toMatch(/^Check-in is not open for this event\.$/);
    expect(mapped.message).toMatch(/start|publish|open/i);
  });
});
