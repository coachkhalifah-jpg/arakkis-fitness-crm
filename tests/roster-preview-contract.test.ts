import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Roster preview name links (UAT-028)", () => {
  const preview = readFileSync(join(root, "src/components/admin/roster-preview.tsx"), "utf8");
  const page = readFileSync(join(root, "src/app/admin/events/[id]/page.tsx"), "utf8");

  it("links only the display name to the People profile", () => {
    expect(preview).toContain("href={`/admin/participants/${person.id}`}");
    expect(preview).toContain('className="admin-roster-preview-name"');
    expect(preview).toMatch(
      /<\/Link>\s*<\/strong>\s*\{canViewPhone && person\.phone \? <small>\{person\.phone\}<\/small>/,
    );
    expect(preview).not.toMatch(/<li[^>]*onClick/);
  });

  it("passes participant_id into roster preview rows", () => {
    expect(page).toContain("id: registration.participant_id");
    expect(page).toContain("<RosterPreview");
  });
});
