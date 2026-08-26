export type AttendancePresentation = {
  label: "IN" | "No-show" | "Not checked in";
  kind: "attended" | "no-show" | "unresolved";
};

/**
 * Formats attendance for staff-facing roster surfaces.
 * NO_SHOW is only a resolved presentation after attendance processing is
 * finalized; an open/unresolved row remains intentionally quiet.
 */
export function attendancePresentation(
  attendanceStatus: string,
  attendanceState: string,
): AttendancePresentation {
  if (attendanceStatus === "ATTENDED") {
    return { label: "IN", kind: "attended" };
  }
  if (attendanceStatus === "NO_SHOW" && attendanceState === "FINALIZED") {
    return { label: "No-show", kind: "no-show" };
  }
  return { label: "Not checked in", kind: "unresolved" };
}
