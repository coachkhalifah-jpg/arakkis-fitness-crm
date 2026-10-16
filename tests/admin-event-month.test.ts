import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eventMonthKey, eventMonthLabel, groupEventsByMonthKey } from "@/lib/admin/event-month";

describe("UAT-026 America/New_York month bucketing", () => {
  it("buckets by New York wall month, not bare UTC month near boundaries", () => {
    // 2026-11-01 03:30 UTC == 2026-10-31 23:30 EDT → October
    expect(eventMonthKey("2026-11-01T03:30:00.000Z")).toBe("2026-10");
    // 2026-11-01 05:00 UTC == 2026-11-01 01:00 EDT → November
    expect(eventMonthKey("2026-11-01T05:00:00.000Z")).toBe("2026-11");
  });

  it("labels months briefly for discovery chrome", () => {
    expect(eventMonthLabel("2026-10")).toMatch(/Oct/);
    expect(eventMonthLabel("2026-10")).toMatch(/2026/);
  });

  it("groups chronologically and omits empty months by construction", () => {
    const groups = groupEventsByMonthKey([
      { startsAt: "2026-12-02T15:00:00.000Z", id: "b" },
      { startsAt: "2026-10-15T15:00:00.000Z", id: "a" },
      { startsAt: "2026-12-10T15:00:00.000Z", id: "c" },
    ]);
    expect(groups.map((group) => group.key)).toEqual(["2026-10", "2026-12"]);
    expect(groups[1]?.events).toHaveLength(2);
  });
});

describe("UAT-026 discovery wiring", () => {
  const discovery = readFileSync(
    join(process.cwd(), "src/components/admin/admin-events-discovery.tsx"),
    "utf8",
  );

  it("adds month multiselect and month organizer rows", () => {
    expect(discovery).toContain("admin-events-filter-months");
    expect(discovery).toContain("By month");
    expect(discovery).toContain("groupEventsByMonthKey");
    expect(discovery).toContain("toggleMonth");
    expect(discovery).toContain('data-testid="admin-event-discovery-months"');
  });

  it("hides By month unless at least one month is selected", () => {
    expect(discovery).toContain("monthsSelected");
    expect(discovery).toContain("nonMonthFiltersActive");
    expect(discovery).toMatch(/monthsSelected \? \(/);
  });

  it("keeps Filters active outside the Filter button for contrast", () => {
    expect(discovery).toContain("admin-event-discovery-filter-trigger-group");
    const toggleStart = discovery.indexOf('className="admin-event-discovery-filter-button"');
    const toggleEnd = discovery.indexOf("</DisclosureToggle>", toggleStart);
    const insideToggle = discovery.slice(toggleStart, toggleEnd);
    expect(discovery).toContain("Filters active");
    expect(insideToggle).not.toContain("Filters active");
  });

  it("keeps This week and By Organization alongside month rows", () => {
    expect(discovery).toContain("This week");
    expect(discovery).toContain("By Organization");
  });
});

describe("migration numbering collision fix", () => {
  it("renumbers take-home workout theme off the DEC-071 0084 slot", () => {
    const theme = readFileSync(
      join(process.cwd(), "supabase/migrations/0086_take_home_workout_theme.sql"),
      "utf8",
    );
    expect(theme).toContain("0086");
    expect(theme).toContain("take_home_workouts");
  });
});
