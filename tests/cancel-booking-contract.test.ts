import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Cancel booking completion (UAT-024)", () => {
  const actions = readFileSync(join(root, "src/lib/registration/booking-actions.ts"), "utf8");
  const dialog = readFileSync(
    join(root, "src/components/registration/cancel-booking-dialog.tsx"),
    "utf8",
  );

  it("returns a distinct success state so useActionState pending can clear", () => {
    expect(actions).toContain("CancelBookingActionState");
    expect(actions).toMatch(
      /export async function cancelBookingAction\(\s*_state: CancelBookingActionState,\s*form: FormData,\s*\): Promise<CancelBookingActionState>/,
    );
    expect(actions).toContain('return { success: true }');
    expect(actions).not.toMatch(
      /cancelBookingAction[\s\S]*?return undefined;\s*\n\}/,
    );
  });

  it("closes the dialog and refreshes the route on cancel success", () => {
    expect(dialog).toContain("useActionState");
    expect(dialog).toContain("cancelBookingAction");
    expect(dialog).toContain("router.refresh()");
    expect(dialog).toContain("setOpen(false)");
    expect(dialog).toContain("state.success");
    expect(dialog).toContain('role="alert"');
    expect(dialog).toContain("disabled={pending}");
    expect(dialog).toContain("Cancelling…");
  });
});
