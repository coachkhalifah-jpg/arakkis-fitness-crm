import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Published event capacity edit (DEC-009 / FR-005)", () => {
  const migration = readFileSync(
    join(root, "supabase/migrations/0087_published_event_capacity_edit_replace.sql"),
    "utf8",
  );
  const actions = readFileSync(join(root, "src/lib/services/phase-3-actions.ts"), "utf8");
  const sqlTest = readFileSync(
    join(root, "supabase/tests/phase-16-published-capacity-edit.sql"),
    "utf8",
  );

  it("replaces phase 3 guards without capacity immutability", () => {
    expect(migration).toContain("create or replace function public.enforce_event_phase_3_guards");
    expect(migration).toContain("registration_deadline is distinct from old.registration_deadline");
    expect(migration).not.toMatch(/new\.capacity\s+is distinct from\s+old\.capacity/);
    expect(migration).not.toMatch(/new\.capacity\s*<>\s*old\.capacity/);
  });

  it("omits schedule columns from published Event Update patches", () => {
    const updateFn = actions.slice(actions.indexOf("export async function updateEvent"));
    expect(updateFn).toContain("const patch = published");
    expect(updateFn).toContain("published_patch: published");
    expect(updateFn).toMatch(/migration 0087 is applied/);
    // Published branch must not assign starts_at on the patch object.
    const publishedBranch = updateFn.slice(
      updateFn.indexOf("const patch = published"),
      updateFn.indexOf(": {", updateFn.indexOf("const patch = published")) + 200,
    );
    expect(publishedBranch).not.toContain("starts_at:");
  });

  it("keeps a SQL catalog assertion for the guard rewrite", () => {
    expect(sqlTest).toContain("new.capacity%old.capacity");
    expect(sqlTest).toContain("enforce_event_phase_3_guards");
  });
});
