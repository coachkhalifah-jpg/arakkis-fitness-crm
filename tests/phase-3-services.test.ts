import { describe, expect, it } from "vitest";
import {
  buildWeeklyOccurrences,
  eventSchema,
  localDateTimeToUtc,
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
    });
    expect(() => buildWeeklyOccurrences(input, "America/New_York", "2026-01-08")).toThrow(
      /on or after/i,
    );
  });
});
