import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("UX-R004 Finalize / Reopen attendance feedback", () => {
  const page = readFileSync(join(root, "src/app/admin/events/[id]/page.tsx"), "utf8");
  const finalizeForm = readFileSync(
    join(root, "src/components/admin/finalize-attendance-form.tsx"),
    "utf8",
  );
  const reopenForm = readFileSync(
    join(root, "src/components/admin/reopen-attendance-form.tsx"),
    "utf8",
  );
  const phase5 = readFileSync(join(root, "src/lib/services/phase-5-actions.ts"), "utf8");

  it("does not bind Manage Event Finalize/Reopen to result-discarding submit wrappers", () => {
    expect(page).not.toMatch(/finalizeAttendanceSubmit/);
    expect(page).not.toMatch(/reopenAttendanceSubmit/);
    expect(page).toContain("FinalizeAttendanceForm");
    expect(page).toContain("ReopenAttendanceForm");
  });

  it("wires Finalize and Reopen through useActionState on stateful attendance actions", () => {
    expect(finalizeForm).toContain("useActionState");
    expect(finalizeForm).toContain("finalizeAttendance");
    expect(finalizeForm).not.toContain("finalizeAttendanceSubmit");
    expect(reopenForm).toContain("useActionState");
    expect(reopenForm).toContain("reopenAttendance");
    expect(reopenForm).not.toContain("reopenAttendanceSubmit");
    expect(phase5).toMatch(
      /export async function finalizeAttendance\(\s*_state: Phase3ActionState,\s*form: FormData,\s*\): Promise<Phase3ActionState>/,
    );
    expect(phase5).toMatch(
      /export async function reopenAttendance\(\s*_state: Phase3ActionState,\s*form: FormData,\s*\): Promise<Phase3ActionState>/,
    );
  });

  it("surfaces inline error and success for Finalize and Reopen", () => {
    expect(finalizeForm).toContain('role="alert"');
    expect(finalizeForm).toContain('role="status"');
    expect(reopenForm).toContain('role="alert"');
    expect(reopenForm).toContain('role="status"');
    expect(finalizeForm).toContain("ConfirmSubmit");
    expect(reopenForm).toContain("ConfirmSubmit");
    expect(reopenForm).toMatch(/name="reason"/);
    expect(reopenForm).toMatch(/\brequired\b/);
  });
});
