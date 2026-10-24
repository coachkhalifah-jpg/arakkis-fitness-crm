import { describe, expect, it } from "vitest";
import { mapAttendanceError } from "@/lib/services/attendance-errors";

describe("UAT-029A attendance window error mapping", () => {
  it("maps pre-window RPC errors", () => {
    const mapped = mapAttendanceError(new Error("attendance check-in window has not opened"));
    expect(mapped.code).toBe("ATTENDANCE_NOT_OPEN");
    expect(mapped.message).toMatch(/30 minutes/i);
  });

  it("keeps generic not-open mapping", () => {
    const mapped = mapAttendanceError(new Error("attendance is not open"));
    expect(mapped.code).toBe("ATTENDANCE_NOT_OPEN");
    expect(mapped.message).toMatch(/not open/i);
  });
});
