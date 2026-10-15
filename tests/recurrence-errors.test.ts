import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { safeScheduleMessage } from "@/lib/services/recurrence-errors";

describe("safeScheduleMessage", () => {
  it("passes through PostgREST-shaped plain objects with schedule overlap text", () => {
    expect(
      safeScheduleMessage({
        message: "the schedule overlaps an existing schedule rule",
        details: null,
        hint: null,
        code: "23505",
      }),
    ).toBe("the schedule overlaps an existing schedule rule");
  });

  it("prefers details/hint when message is opaque but details are actionable", () => {
    expect(
      safeScheduleMessage({
        message: "Database error",
        details: "the schedule has no valid future occurrences remaining",
        hint: "Extend the series or pick another weekday",
        code: "22023",
      }),
    ).toBe("the schedule has no valid future occurrences remaining");
  });

  it("surfaces registration-window and DST-style series errors from Error instances", () => {
    expect(
      safeScheduleMessage(
        new Error("canonical series registration window cannot be propagated safely"),
      ),
    ).toBe("canonical series registration window cannot be propagated safely");
    expect(
      safeScheduleMessage(
        new Error("schedule contains a local time that does not exist in the Venue timezone"),
      ),
    ).toBe("schedule contains a local time that does not exist in the Venue timezone");
  });

  it("keeps Zod field messages and falls back for unrelated noise", () => {
    expect(
      safeScheduleMessage(
        new ZodError([
          {
            code: "custom",
            path: ["localStartTime"],
            message: "Enter a valid local time.",
          },
        ]),
      ),
    ).toBe("Enter a valid local time.");
    expect(safeScheduleMessage({ message: "jwt expired", code: "PGRST301" })).toBe(
      "The schedule change could not be completed.",
    );
    expect(safeScheduleMessage(undefined)).toBe("The schedule change could not be completed.");
  });
});
