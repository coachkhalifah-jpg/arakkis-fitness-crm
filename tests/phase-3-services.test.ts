import { describe, expect, it } from "vitest";
import {
  buildMultiScheduleOccurrences,
  buildWeeklyOccurrences,
  eventSchema,
  localDateTimeToUtc,
  multiScheduleSchema,
  parseEventTimes,
} from "@/lib/services/phase-3";

describe("Phase 3 event scheduling", () => {
  it("converts venue-local time to the correct UTC instant", () => {
    expect(localDateTimeToUtc("2026-01-15T10:00", "America/New_York")).toBe(
      "2026-01-15T15:00:00.000Z",
    );
  });

  it("rejects a nonexistent spring-forward local time", () => {
    expect(() => localDateTimeToUtc("2026-03-08T02:30", "America/New_York")).toThrow(
      /does not exist/i,
    );
  });

  it("requires an occurrence for an ambiguous fall-back local time", () => {
    expect(() => localDateTimeToUtc("2026-11-01T01:30", "America/New_York")).toThrow(/occurrence/i);
    expect(localDateTimeToUtc("2026-11-01T01:30", "America/New_York", "second")).toBe(
      "2026-11-01T06:30:00.000Z",
    );
  });

  it("rejects an end before the start and a late registration deadline", () => {
    const input = eventSchema.parse({
      hostOrganizationId: "00000000-0000-0000-0000-000000000001",
      venueId: "00000000-0000-0000-0000-000000000002",
      name: "Morning class",
      startLocal: "2026-01-15T10:00",
      endLocal: "2026-01-15T09:00",
      registrationDeadlineLocal: "2026-01-15T11:00",
      capacity: 20,
      visibility: "PUBLIC",
      accessMode: "PUBLIC",
    });
    expect(() => parseEventTimes(input, "America/New_York")).toThrow(/after start/i);
  });

  it("materializes weekly occurrences through an inclusive end date", () => {
    const input = eventSchema.parse({
      hostOrganizationId: "00000000-0000-0000-0000-000000000001",
      venueId: "00000000-0000-0000-0000-000000000002",
      name: "Weekly class",
      startLocal: "2026-01-15T10:00",
      endLocal: "2026-01-15T11:00",
      registrationDeadlineLocal: "2026-01-15T09:00",
      capacity: 20,
      visibility: "PUBLIC",
      accessMode: "PUBLIC",
    });
    const occurrences = buildWeeklyOccurrences(input, "America/New_York", "2026-02-05");
    expect(occurrences).toHaveLength(4);
    expect(occurrences.map((item) => item.localDate)).toEqual([
      "2026-01-15",
      "2026-01-22",
      "2026-01-29",
      "2026-02-05",
    ]);
  });

  it("rejects a recurring end date before the first date", () => {
    const input = eventSchema.parse({
      hostOrganizationId: "00000000-0000-0000-0000-000000000001",
      venueId: "00000000-0000-0000-0000-000000000002",
      name: "Weekly class",
      startLocal: "2026-01-15T10:00",
      endLocal: "2026-01-15T11:00",
      registrationDeadlineLocal: "2026-01-15T09:00",
      capacity: 20,
      visibility: "PUBLIC",
      accessMode: "PUBLIC",
    });
    expect(() => buildWeeklyOccurrences(input, "America/New_York", "2026-01-08")).toThrow(
      /on or after/i,
    );
  });

  it("accepts multiple non-overlapping weekday schedules and preserves schedule order", () => {
    const input = eventSchema.parse({
      hostOrganizationId: "00000000-0000-0000-0000-000000000001",
      venueId: "00000000-0000-0000-0000-000000000002",
      name: "Multi schedule class",
      startLocal: "2026-01-19T10:00",
      endLocal: "2026-01-19T11:00",
      registrationDeadlineLocal: "2026-01-19T09:00",
      capacity: 20,
      visibility: "PUBLIC",
      accessMode: "PUBLIC",
    });
    const rules = multiScheduleSchema.parse([
      { weekday: 1, localStartTime: "10:00", localEndTime: "11:00" },
      { weekday: 3, localStartTime: "18:00", localEndTime: "19:00" },
    ]);
    const occurrences = buildMultiScheduleOccurrences(
      input,
      rules,
      "America/New_York",
      "2026-02-04",
    );
    expect(occurrences.map((item) => item.localDate)).toEqual([
      "2026-01-19",
      "2026-01-21",
      "2026-01-26",
      "2026-01-28",
      "2026-02-02",
      "2026-02-04",
    ]);
  });

  it("rejects duplicate and overlapping schedule rows", () => {
    expect(() =>
      multiScheduleSchema.parse([
        { weekday: 1, localStartTime: "10:00", localEndTime: "11:00" },
        { weekday: 1, localStartTime: "10:00", localEndTime: "11:00" },
      ]),
    ).toThrow(/duplicate/i);
    expect(() =>
      multiScheduleSchema.parse([
        { weekday: 1, localStartTime: "10:00", localEndTime: "11:00" },
        { weekday: 1, localStartTime: "10:30", localEndTime: "11:30" },
      ]),
    ).toThrow(/overlap/i);
  });

  it("rejects a multi-schedule bundle that exceeds 104 generated dates", () => {
    const input = eventSchema.parse({
      hostOrganizationId: "00000000-0000-0000-0000-000000000001",
      venueId: "00000000-0000-0000-0000-000000000002",
      name: "Long multi schedule class",
      startLocal: "2026-01-05T10:00",
      endLocal: "2026-01-05T11:00",
      registrationDeadlineLocal: "2026-01-05T09:00",
      capacity: 20,
      visibility: "PUBLIC",
      accessMode: "PUBLIC",
    });
    const rules = multiScheduleSchema.parse([
      { weekday: 1, localStartTime: "10:00", localEndTime: "11:00" },
      { weekday: 2, localStartTime: "10:00", localEndTime: "11:00" },
      { weekday: 3, localStartTime: "10:00", localEndTime: "11:00" },
    ]);
    expect(() =>
      buildMultiScheduleOccurrences(input, rules, "America/New_York", "2027-01-05"),
    ).toThrow(/104/);
  });
});
