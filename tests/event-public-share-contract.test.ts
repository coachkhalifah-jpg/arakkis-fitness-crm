import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Event public share / slug save", () => {
  const actions = readFileSync(join(root, "src/lib/services/phase-7-actions.ts"), "utf8");
  const panel = readFileSync(
    join(root, "src/components/admin/event-public-share-panel.tsx"),
    "utf8",
  );
  const page = readFileSync(join(root, "src/app/admin/events/[id]/page.tsx"), "utf8");
  const qr = readFileSync(join(root, "src/app/admin/events/[id]/qr/route.ts"), "utf8");

  it("surfaces slug save errors instead of swallowing them", () => {
    expect(actions).toContain("setPhase7SlugAction");
    expect(actions).toContain("no row updated");
    expect(actions).toContain("That public slug is already in use.");
    expect(actions).toMatch(/if \(result\.error\) throw/);
  });

  it("puts share/QR + slug controls in Share and calendar with empty-state copy", () => {
    expect(page).toContain("EventPublicSharePanel");
    expect(panel).toContain("No public registration link yet");
    expect(panel).toContain("Save slug");
    expect(panel).toContain("router.refresh()");
  });

  it("resolves series slug whether PostgREST returns object or array", () => {
    expect(qr).toContain("Array.isArray(seriesRelation)");
    expect(qr).not.toMatch(/event_series\?\.\[0\]\?\.public_slug/);
  });
});
