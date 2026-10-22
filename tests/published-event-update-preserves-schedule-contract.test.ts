import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const actions = readFileSync(join(root, "src/lib/services/phase-3-actions.ts"), "utf8");

describe("Published event Update preserves schedule (capacity-only safe)", () => {
  it("does not rewrite schedule/ownership from form locals after publish", () => {
    const updateFn = actions.slice(actions.indexOf("export async function updateEvent"));
    expect(updateFn).toContain('const published = old.status !== "DRAFT"');
    expect(updateFn).toContain("startsAt: old.starts_at");
    expect(updateFn).toContain("endsAt: old.ends_at");
    expect(updateFn).toContain("registrationDeadline: old.registration_deadline");
    expect(updateFn).toContain("published ? (old.timezone as string) : venue.timezone");
    expect(updateFn).toContain(
      "host_organization_id: published ? old.host_organization_id : input.hostOrganizationId",
    );
    expect(updateFn).toContain("venue_id: published ? old.venue_id : input.venueId");
  });

  it("still parses form times for DRAFT edits", () => {
    const updateFn = actions.slice(actions.indexOf("export async function updateEvent"));
    expect(updateFn).toContain("parseEventTimes(input, venue.timezone)");
  });
});
