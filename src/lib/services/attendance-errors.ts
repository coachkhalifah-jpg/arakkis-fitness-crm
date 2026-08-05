export type AttendanceErrorCode =
  | "REQUIRED_INFORMATION"
  | "DUPLICATE_REGISTRATION"
  | "CAPACITY_REACHED"
  | "ATTENDANCE_FINALIZED"
  | "CORRECTION_REASON_REQUIRED"
  | "UNAUTHORIZED"
  | "SESSION_EXPIRED"
  | "ATTENDANCE_NOT_OPEN"
  | "WALK_IN_FAILED"
  | "UNEXPECTED";

export type AttendanceError = {
  code: AttendanceErrorCode;
  message: string;
  nextAction: string;
};

export function mapAttendanceError(error: unknown): AttendanceError {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : "";
  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  const combined = `${message} ${code}`;
  if (/refresh token|session expired|jwt expired/i.test(combined))
    return {
      code: "SESSION_EXPIRED",
      message: "Your admin session has expired.",
      nextAction: "Sign in again and retry the attendance action.",
    };
  if (/reason is required|correction reason/i.test(combined))
    return {
      code: "CORRECTION_REASON_REQUIRED",
      message: "A reason is required for this attendance correction.",
      nextAction: "Enter a brief reason, then save the correction.",
    };
  if (/acknowledgment.*unavailable/i.test(combined))
    return {
      code: "REQUIRED_INFORMATION",
      message: "Required acknowledgment information is unavailable.",
      nextAction: "Refresh the page and retry; contact a System Admin if it persists.",
    };
  if (code === "23514" || /capacity/i.test(message))
    return {
      code: "CAPACITY_REACHED",
      message: "This event is at capacity.",
      nextAction: "Ask a System Admin to use an explicit override if appropriate.",
    };
  if (/duplicate|already registered/i.test(message))
    return {
      code: "DUPLICATE_REGISTRATION",
      message: "This participant is already registered for this event.",
      nextAction: "Review the existing roster entry instead of creating another registration.",
    };
  if (/finalized/i.test(message))
    return {
      code: "ATTENDANCE_FINALIZED",
      message: "Attendance is finalized.",
      nextAction: "Enter a correction reason if you are authorized to correct this event.",
    };
  if (code === "42501" || /unauthorized|forbidden|unavailable/i.test(message))
    return {
      code: "UNAUTHORIZED",
      message: "You are not authorized to change this event's attendance.",
      nextAction: "Open an event assigned to your organization or ask a System Admin.",
    };
  if (/open/i.test(message))
    return {
      code: "ATTENDANCE_NOT_OPEN",
      message: "Check-in is not open for this event.",
      nextAction: "Open check-in before recording attendance.",
    };
  if (/required|invalid.*(field|information)|22023/i.test(combined))
    return {
      code: "REQUIRED_INFORMATION",
      message: "Required participant information is missing or invalid.",
      nextAction: "Check the name, phone, country, and required acknowledgment fields.",
    };
  return {
    code: "WALK_IN_FAILED",
    message: "The attendance action could not be saved.",
    nextAction: "Refresh the roster and retry; if it persists, contact a System Admin.",
  };
}
