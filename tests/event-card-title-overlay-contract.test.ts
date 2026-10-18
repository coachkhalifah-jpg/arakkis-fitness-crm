import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const css = readFileSync(join(root, "src/app/globals.css"), "utf8");

function ruleBlock(selector: string) {
  const start = css.indexOf(selector);
  expect(start).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

describe("Event card title overlay — descender / baseline room", () => {
  it("keeps line-height high enough for heavy display type under line-clamp overflow", () => {
    const block = ruleBlock(".event-card-title-overlay {");
    expect(block).toMatch(/-webkit-line-clamp:\s*2/);
    expect(block).toMatch(/overflow:\s*hidden/);
    const lineHeight = block.match(/line-height:\s*([\d.]+)/);
    expect(lineHeight).not.toBeNull();
    expect(Number(lineHeight![1])).toBeGreaterThanOrEqual(1.1);
    expect(block).toMatch(/padding-block:/);
  });

  it("still shares the overlay class from admin and participant cards", () => {
    const admin = readFileSync(join(root, "src/components/admin/admin-event-card.tsx"), "utf8");
    const participant = readFileSync(
      join(root, "src/components/events/participant-event-card.tsx"),
      "utf8",
    );
    expect(admin).toContain("event-card-title-overlay");
    expect(participant).toContain("event-card-title-overlay");
  });
});
