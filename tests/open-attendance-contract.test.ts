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
    const openGate = page.slice(
      page.indexOf('attendance_processing_state === "NOT_STARTED"') - 200,
      page.indexOf('attendance_processing_state === "NOT_STARTED"') + 280,
    );
    expect(openGate).toContain("OpenAttendanceForm");
    expect(openGate).not.toContain('admin.role === "SYSTEM_ADMIN"');
  });
});
