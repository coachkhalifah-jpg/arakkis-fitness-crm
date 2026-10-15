import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Phase3Error } from "@/lib/services/phase-3";
import { safeScheduleMessage } from "@/lib/services/recurrence-errors";
import {
  alignDateToWeekday,
  nextDateForWeekday,
  weekdayForLocalDate,
} from "@/lib/services/recurrence-schedule-dates";

describe("safeScheduleMessage", () => {
  it("surfaces PostgREST message/details/hint instead of the opaque fallback", () => {
    expect(
      safeScheduleMessage({
        message: "the schedule has no valid future occurrences remaining",
        details: null,
        hint: null,
        code: "22023",
      }),
    ).toBe("the schedule has no valid future occurrences remaining");

    expect(
      safeScheduleMessage({
        message: "the schedule overlaps an existing schedule rule",
        details: "Key (event_series_id, weekday)=(...) already exists.",
        hint: "Stop or change the existing Tuesday rule first.",
        code: "23505",
      }),
    ).toBe(
      "the schedule overlaps an existing schedule rule — Key (event_series_id, weekday)=(...) already exists. — Stop or change the existing Tuesday rule first.",
    );
  });

  it("keeps Phase3 and Zod messages, and falls back only when empty", () => {
    expect(
      safeScheduleMessage(new Phase3Error("invalid", "schedule day and time are invalid")),
    ).toBe("schedule day and time are invalid");
    expect(
      safeScheduleMessage(
        new z.ZodError([
          {
            code: "custom",
            message: "Enter a valid effective date.",
            path: ["effectiveStartDate"],
          },
        ]),
      ),
    ).toBe("Enter a valid effective date.");
    expect(safeScheduleMessage({})).toBe("The schedule change could not be completed.");
    expect(safeScheduleMessage(null)).toBe("The schedule change could not be completed.");
  });

  it("does not require the old keyword allowlist for Error instances", () => {
    expect(safeScheduleMessage(new Error("JWT expired"))).toBe("JWT expired");
  });
});

describe("weekday / effective-date alignment", () => {
  it("treats 2026-10-19 as Monday and snaps Tuesday rules to 2026-10-20", () => {
    expect(weekdayForLocalDate("2026-10-19")).toBe(1);
    expect(alignDateToWeekday("2026-10-19", 2)).toBe("2026-10-20");
    expect(alignDateToWeekday("2026-10-20", 2)).toBe("2026-10-20");
    expect(alignDateToWeekday("2026-10-19", 1)).toBe("2026-10-19");
  });

  it("preserves Venue-timezone next-date behavior for weekday selection", () => {
    // Fixed instant: Monday 2026-10-19 15:00 UTC == 11:00 America/New_York.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T15:00:00.000Z"));
    try {
      expect(nextDateForWeekday(2, "19:00", "America/New_York")).toBe("2026-10-20");
      // Same weekday, start already passed locally → next week.
      expect(nextDateForWeekday(1, "10:00", "America/New_York")).toBe("2026-10-26");
      // Same weekday, start still ahead locally → today.
      expect(nextDateForWeekday(1, "12:00", "America/New_York")).toBe("2026-10-19");
      expect(weekdayForLocalDate(nextDateForWeekday(2, "19:00", "America/New_York"))).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
