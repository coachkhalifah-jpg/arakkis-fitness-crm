import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  eventDayKey,
  getBrowserTimeZone,
  isSameAdminLocalDay,
  selectPastEventsOfToday,
} from "@/lib/admin/event-day";
import { ADMIN_EVENT_MONTH_TZ, eventMonthKey } from "@/lib/admin/event-month";

describe("UAT-029B admin-local calendar day", () => {
  it("keys the calendar day in the given admin timezone (not bare UTC)", () => {
    // 2026-10-24 04:30 UTC == 2026-10-23 23:30 in America/Los_Angeles
    expect(eventDayKey("2026-10-24T04:30:00.000Z", "America/Los_Angeles")).toBe("2026-10-23");
    expect(eventDayKey("2026-10-24T04:30:00.000Z", "UTC")).toBe("2026-10-24");
    // Same instant is still Oct 24 morning in New York
    expect(eventDayKey("2026-10-24T04:30:00.000Z", "America/New_York")).toBe("2026-10-24");
  });

  it("matches same admin-local day across TZ edges", () => {
    const now = new Date("2026-10-24T20:00:00.000Z");
    expect(isSameAdminLocalDay("2026-10-24T15:00:00.000Z", now, "America/Chicago")).toBe(true);
    // 2026-10-25 04:00 UTC == Oct 24 evening in Chicago → same local day
    expect(isSameAdminLocalDay("2026-10-25T04:00:00.000Z", now, "America/Chicago")).toBe(true);
    // Next local morning in Chicago
    expect(isSameAdminLocalDay("2026-10-25T06:00:00.000Z", now, "America/Chicago")).toBe(false);
  });
});

describe("UAT-029B Past Events of today", () => {
  const now = new Date("2026-10-24T18:00:00.000Z");
  const tz = "America/Denver";

  it("includes starts_at < now on admin-local today only", () => {
    const past = selectPastEventsOfToday(
      [
        { id: "morning", startsAt: "2026-10-24T15:00:00.000Z" }, // still today in Denver, past
        { id: "upcoming", startsAt: "2026-10-24T22:00:00.000Z" }, // later today — not past
        { id: "yesterday", startsAt: "2026-10-23T18:00:00.000Z" }, // prior local day
        { id: "tomorrow-past-utc", startsAt: "2026-10-25T01:00:00.000Z" }, // still Denver today evening?
      ],
      now,
      tz,
    );
    // Denver is UTC-6 in late Oct (MDT): now = 12:00 local Oct 24
    // morning 15:00Z = 09:00 local → past today
    // upcoming 22:00Z = 16:00 local → future
    // yesterday → excluded
    // 01:00Z Oct 25 = 19:00 local Oct 24 → future relative to noon, same day — not past
    expect(past.map((event) => event.id)).toEqual(["morning"]);
  });

  it("omits empty Past Events by returning []", () => {
    expect(
      selectPastEventsOfToday([{ id: "future", startsAt: "2026-10-24T23:00:00.000Z" }], now, tz),
    ).toEqual([]);
  });

  it("does not change UAT-026 month bucketing timezone", () => {
    expect(ADMIN_EVENT_MONTH_TZ).toBe("America/New_York");
    // Instant near NY month boundary still uses NY for months
    expect(eventMonthKey("2026-11-01T03:30:00.000Z")).toBe("2026-10");
  });
});

describe("UAT-029B discovery wiring", () => {
  const discovery = readFileSync(
    join(process.cwd(), "src/components/admin/admin-events-discovery.tsx"),
    "utf8",
  );
  const dayLib = readFileSync(join(process.cwd(), "src/lib/admin/event-day.ts"), "utf8");

  it("obtains browser TZ via Intl resolvedOptions and wires Past Events", () => {
    expect(dayLib).toContain("Intl.DateTimeFormat().resolvedOptions().timeZone");
    expect(discovery).toContain("getBrowserTimeZone");
    expect(discovery).toContain("selectPastEventsOfToday");
    expect(discovery).toContain("Past Events");
    expect(discovery).toContain('data-testid="admin-event-discovery-past-events"');
    expect(discovery).toContain("pastEventsOfToday.length > 0");
  });

  it("keeps month organizer on America/New_York helpers", () => {
    expect(discovery).toContain("groupEventsByMonthKey");
    expect(discovery).toContain("eventMonthKey");
    expect(discovery).not.toMatch(/groupEventsByMonthKey\([^)]+,\s*adminTimeZone/);
  });

  it("exposes getBrowserTimeZone for client Intl resolution", () => {
    const zone = getBrowserTimeZone();
    expect(typeof zone).toBe("string");
    expect(zone.length).toBeGreaterThan(0);
  });
});
