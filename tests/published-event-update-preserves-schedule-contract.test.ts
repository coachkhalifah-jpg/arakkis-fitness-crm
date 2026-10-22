import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const actions = readFileSync(join(root, "src/lib/services/phase-3-actions.ts"), "utf8");

describe("Published event Update preserves schedule (capacity-only safe)", () => {
  it("builds a published patch without schedule/ownership columns", () => {
    const updateFn = actions.slice(actions.indexOf("export async function updateEvent"));
    expect(updateFn).toContain('const published = old.status !== "DRAFT"');
    expect(updateFn).toContain("const patch = published");
    expect(updateFn).toContain("capacity: input.capacity");
    expect(updateFn).toContain(".update(patch)");
    expect(updateFn).not.toMatch(/const patch = published\s*\?\s*\{[^}]*starts_at:/s);
  });

  it("still parses form times for DRAFT edits", () => {
    const updateFn = actions.slice(actions.indexOf("export async function updateEvent"));
    expect(updateFn).toContain("parseEventTimes(input, venue.timezone)");
    expect(updateFn).toContain("starts_at: times.startsAt");
  });
});
