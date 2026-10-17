import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Event registration pause / resume (UX-R001)", () => {
  const actions = readFileSync(join(root, "src/lib/services/phase-7-actions.ts"), "utf8");
  const controls = readFileSync(
    join(root, "src/components/admin/event-registration-pause-controls.tsx"),
    "utf8",
  );
  const page = readFileSync(join(root, "src/app/admin/events/[id]/page.tsx"), "utf8");

  it("does not swallow pause/resume action results", () => {
    expect(actions).toContain("pausePhase7EventForm");
    expect(actions).toContain("resumePhase7EventForm");
    expect(actions).toContain("no row updated");
    expect(actions).toMatch(
      /export async function pausePhase7EventForm\(\s*_state: Phase7ActionState/,
    );
    expect(actions).toMatch(
      /export async function resumePhase7EventForm\(\s*_state: Phase7ActionState/,
    );
    expect(actions).toMatch(
      /return setRegistrationPaused\(eventId, true\);/,
    );
    expect(actions).toMatch(
      /return setRegistrationPaused\(eventId, false\);/,
    );
    expect(actions).not.toMatch(
      /await setRegistrationPaused\(String\(formData\.get\("eventId"\)/,
    );
  });

  it("surfaces pause/resume error and success with pending disable", () => {
    expect(page).toContain("EventRegistrationPauseControls");
    expect(controls).toContain("useActionState");
    expect(controls).toContain('role="alert"');
    expect(controls).toContain('role="status"');
    expect(controls).toContain("disabled={pending}");
    expect(controls).toContain("router.refresh()");
  });
});
