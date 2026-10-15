import { afterEach, describe, expect, it, vi } from "vitest";
import {
  pickSeriesMainImageSource,
  selectFutureNonCancelledOccurrenceIds,
} from "@/lib/services/series-event-image";

describe("series main image selection", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fans out only to future non-cancelled occurrences", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
    const ids = selectFutureNonCancelledOccurrenceIds([
      { id: "past", starts_at: "2026-10-14T18:00:00.000Z", status: "OPEN" },
      { id: "cancelled", starts_at: "2026-10-20T18:00:00.000Z", status: "CANCELLED" },
      { id: "future-a", starts_at: "2026-10-16T18:00:00.000Z", status: "OPEN" },
      { id: "future-b", starts_at: "2026-10-23T18:00:00.000Z", status: "DRAFT" },
    ]);
    expect(ids).toEqual(["future-a", "future-b"]);
  });

  it("prefers the soonest future non-cancelled asset as the inheritance source", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
    const source = pickSeriesMainImageSource([
      {
        eventId: "past",
        startsAt: "2026-10-01T18:00:00.000Z",
        status: "OPEN",
        seriesOccurrenceNumber: 1,
        asset: {
          storage_path: "old.png",
          original_filename: "old.png",
          mime_type: "image/png",
          byte_size: 10,
          alt_text: "old",
          focal_position: "center",
          event_id: "past",
        },
      },
      {
        eventId: "future-late",
        startsAt: "2026-10-30T18:00:00.000Z",
        status: "OPEN",
        seriesOccurrenceNumber: 3,
        asset: {
          storage_path: "late.png",
          original_filename: "late.png",
          mime_type: "image/png",
          byte_size: 10,
          alt_text: "late",
          focal_position: "center",
          event_id: "future-late",
        },
      },
      {
        eventId: "future-soon",
        startsAt: "2026-10-16T18:00:00.000Z",
        status: "OPEN",
        seriesOccurrenceNumber: 2,
        asset: {
          storage_path: "soon.png",
          original_filename: "soon.png",
          mime_type: "image/png",
          byte_size: 10,
          alt_text: "soon",
          focal_position: "center",
          event_id: "future-soon",
        },
      },
    ]);
    expect(source?.storage_path).toBe("soon.png");
    expect(source?.event_id).toBe("future-soon");
  });

  it("falls back to the canonical template asset when no future image exists", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
    const source = pickSeriesMainImageSource([
      {
        eventId: "template",
        startsAt: "2026-09-01T18:00:00.000Z",
        status: "COMPLETED",
        seriesOccurrenceNumber: 1,
        asset: {
          storage_path: "template.png",
          original_filename: "template.png",
          mime_type: "image/png",
          byte_size: 10,
          alt_text: "template",
          focal_position: "center",
          event_id: "template",
        },
      },
      {
        eventId: "future-bare",
        startsAt: "2026-10-20T18:00:00.000Z",
        status: "OPEN",
        seriesOccurrenceNumber: 2,
        asset: null,
      },
    ]);
    expect(source?.storage_path).toBe("template.png");
  });
});
