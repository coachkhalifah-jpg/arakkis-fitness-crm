import { describe, expect, it } from "vitest";
import { attendancePresentation } from "@/lib/services/attendance-presentation";

describe("attendance presentation", () => {
  it("keeps an open unresolved registration as not checked in", () => {
    expect(attendancePresentation("NOT_RECORDED", "OPEN")).toEqual({
      label: "Not checked in",
      kind: "unresolved",
    });
  });

  it("presents a finalized no-show distinctly", () => {
    expect(attendancePresentation("NO_SHOW", "FINALIZED")).toEqual({
      label: "No-show",
      kind: "no-show",
    });
  });

  it("preserves the canonical attended presentation", () => {
    expect(attendancePresentation("ATTENDED", "FINALIZED")).toEqual({
      label: "IN",
      kind: "attended",
    });
  });

  it("does not present an unresolved no-show before finalization", () => {
    expect(attendancePresentation("NO_SHOW", "OPEN").label).toBe("Not checked in");
  });
});
