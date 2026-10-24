import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Open check-in attendance control", () => {
  const page = readFileSync(join(root, "src/app/admin/events/[id]/page.tsx"), "utf8");
  const openForm = readFileSync(
    join(root, "src/components/admin/open-attendance-form.tsx"),
    "utf8",
  );
  const phase5 = readFileSync(join(root, "src/lib/services/phase-5-actions.ts"), "utf8");

  it("shows Open check-in on Manage Event when attendance is NOT_STARTED", () => {
    expect(page).toContain("OpenAttendanceForm");
    expect(page).toContain('attendance_processing_state === "NOT_STARTED"');
    expect(page).not.toMatch(/openAttendanceSubmit/);
    expect(page).toMatch(
      /status !== "CANCELLED"[\s\S]*status !== "DRAFT"[\s\S]*NOT_STARTED[\s\S]*OpenAttendanceForm/,
    );
  });

  it("wires Open check-in through useActionState on openAttendance", () => {
    expect(openForm).toContain("useActionState");
    expect(openForm).toContain("openAttendance");
    expect(openForm).not.toContain("openAttendanceSubmit");
    expect(openForm).toContain("ConfirmSubmit");
    expect(openForm).toContain("Open check-in");
    expect(phase5).toMatch(
      /export async function openAttendance\(\s*_state: Phase3ActionState,\s*form: FormData,\s*\): Promise<Phase3ActionState>/,
    );
  });

  it("surfaces inline error and success for Open check-in", () => {
    expect(openForm).toContain('role="alert"');
    expect(openForm).toContain('role="status"');
    expect(openForm).toContain('data-testid="open-attendance-form"');
  });

  it("allows Host Admin as well as System Admin (no SYSTEM_ADMIN-only gate on Open)", () => {
    const formIndex = page.indexOf("<OpenAttendanceForm");
    const openGate = page.slice(Math.max(0, formIndex - 280), formIndex + 80);
    expect(openGate).toContain('attendance_processing_state === "NOT_STARTED"');
    expect(openGate).toContain("OpenAttendanceForm");
    expect(openGate).not.toContain('admin.role === "SYSTEM_ADMIN"');
  });

  it("reconciles auto-open on Manage Event access when still NOT_STARTED", () => {
    expect(page).toContain("reconcileAttendanceOpenForEvent");
    expect(page).toMatch(
      /attendance_processing_state === "NOT_STARTED"[\s\S]*reconcileAttendanceOpenForEvent/,
    );
  });
});

describe("UAT-029A check-in window auto-open wiring", () => {
  const eventsPage = readFileSync(join(root, "src/app/admin/events/page.tsx"), "utf8");
  const migration = readFileSync(
    join(root, "supabase/migrations/0088_attendance_checkin_auto_open_window.sql"),
    "utf8",
  );
  const errors = readFileSync(join(root, "src/lib/services/attendance-errors.ts"), "utf8");

  it("batch-reconciles due opens on Admin Events discovery", () => {
    expect(eventsPage).toContain("reconcileDueAttendanceOpens");
  });

  it("defines T-30m opens_at helper and auto-open RPCs", () => {
    expect(migration).toContain("phase5_attendance_check_in_opens_at");
    expect(migration).toContain("interval '30 minutes'");
    expect(migration).toContain("phase5_auto_open_attendance_if_due");
    expect(migration).toContain("phase5_reconcile_due_attendance_opens");
    expect(migration).toContain("attendance check-in window has not opened");
    expect(migration).toContain("'source', 'AUTO'");
    expect(migration).toContain("'source', 'MANUAL'");
  });

  it("maps pre-window errors to a clear coach message", () => {
    expect(errors).toContain("Check-in opens 30 minutes before the event starts.");
  });
});
