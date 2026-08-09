import { describe, expect, it } from "vitest";
import { mapAttendanceError } from "@/lib/services/attendance-errors";

describe("attendance error mapping", () => {
  it("prioritizes a correction reason over the generic required-field message", () => {
    expect(mapAttendanceError({ code: "22023", message: "correction reason is required" })).toEqual(
      expect.objectContaining({
        code: "CORRECTION_REASON_REQUIRED",
        message: "A reason is required for this attendance correction.",
      }),
    );
  });

  it("maps expected capacity and authorization failures without exposing internals", () => {
    expect(mapAttendanceError({ code: "23514", message: "capacity reached" }).code).toBe(
      "CAPACITY_REACHED",
    );
    expect(mapAttendanceError({ code: "42501", message: "event unavailable" }).code).toBe(
      "UNAUTHORIZED",
    );
    expect(mapAttendanceError({ code: "XX000", message: "database secret details" })).toEqual(
      expect.objectContaining({
        code: "WALK_IN_FAILED",
        message: "The attendance action could not be saved.",
      }),
    );
  });
});
