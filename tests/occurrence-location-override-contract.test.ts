import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("UX-R005 Occurrence location override", () => {
  const actions = readFileSync(join(root, "src/lib/services/phase-3-actions.ts"), "utf8");
  const form = readFileSync(
    join(root, "src/components/admin/occurrence-location-override-form.tsx"),
    "utf8",
  );
  const page = readFileSync(join(root, "src/app/admin/events/[id]/page.tsx"), "utf8");

  it("reads locationOverrideVenueId and does not swallow action results", () => {
    const overrideFn = actions.slice(
      actions.indexOf("export async function setOccurrenceLocationOverride("),
      actions.indexOf("export async function setOccurrenceLocationOverrideAction("),
    );
    expect(overrideFn).toContain('value(form, "locationOverrideVenueId")');
    expect(overrideFn).not.toContain('value(form, "venueId")');
    expect(actions).toContain("setOccurrenceLocationOverrideAction");
    expect(overrideFn).toContain("no row updated");
    expect(overrideFn).toContain('.select("id,location_override_venue_id")');
    expect(actions).not.toContain("setOccurrenceLocationOverrideSubmit");
  });

  it("uses its own useActionState form with unique field name, not folded into Update", () => {
    expect(page).toContain("OccurrenceLocationOverrideForm");
    expect(page).not.toContain("setOccurrenceLocationOverrideSubmit");
    expect(form).toContain('name="locationOverrideVenueId"');
    expect(form).toContain("useActionState");
    expect(form).toContain("setOccurrenceLocationOverrideAction");
    expect(form).toContain('role="alert"');
    expect(form).toContain('role="status"');
    expect(form).toContain("SubmitButton");
    expect(form).toMatch(/<form[\s\S]*action=\{action\}/);
  });

  it("lives at the bottom of Event Basics without amber special panel", () => {
    const basics = page.slice(
      page.indexOf('id="manage-event-basics"'),
      page.indexOf('id="manage-event-schedule"'),
    );
    expect(basics).toContain("OccurrenceLocationOverrideForm");
    expect(basics.indexOf("Capacity")).toBeLessThan(
      basics.indexOf("OccurrenceLocationOverrideForm"),
    );
    expect(form).not.toMatch(/amber-/);
    expect(form).toContain("Occurrence location");
    expect(form).toContain(
      "This changes this occurrence only; the series and other dates keep their locations.",
    );
  });
});
