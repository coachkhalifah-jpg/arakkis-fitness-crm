import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("UX-R002 / UX-R007 cancel archive copy feedback", () => {
  const actions = readFileSync(join(root, "src/lib/services/phase-3-actions.ts"), "utf8");
  const rare = readFileSync(
    join(root, "src/components/admin/event-rare-lifecycle-actions.tsx"),
    "utf8",
  );
  const archiveButton = readFileSync(
    join(root, "src/components/admin/archive-cancelled-event-button.tsx"),
    "utf8",
  );
  const detail = readFileSync(join(root, "src/app/admin/events/[id]/page.tsx"), "utf8");
  const discovery = readFileSync(
    join(root, "src/components/admin/admin-events-discovery.tsx"),
    "utf8",
  );
  const bulkBar = readFileSync(
    join(root, "src/components/admin/events-bulk-lifecycle-bar.tsx"),
    "utf8",
  );

  it("exposes useActionState wrappers that return Phase3ActionState", () => {
    expect(actions).toContain("export async function copyEventAction");
    expect(actions).toContain("export async function cancelEventAction");
    expect(actions).toContain("export async function archiveCancelledEventAction");
    expect(actions).not.toMatch(
      /export async function copyEventForm\(id: string\) \{\s*await copyEvent\(id\);\s*\}/,
    );
    expect(actions).not.toMatch(
      /export async function cancelEventForm\(id: string\) \{\s*await cancelEvent\([^)]+\);\s*\}/,
    );
    expect(actions).not.toMatch(
      /export async function archiveCancelledEventForm\(id: string\) \{\s*await archiveCancelledEvent\(id\);\s*\}/,
    );
  });

  it("revalidates event detail after cancel and returns createdEventId from copy", () => {
    expect(actions).toMatch(
      /export async function cancelEvent[\s\S]*?revalidatePath\(`\/admin\/events\/\$\{id\}`\)/,
    );
    expect(actions).toMatch(/createdEventId:\s*data\.id/);
    expect(actions).toMatch(
      /if \(result\.createdEventId\) redirect\(`\/admin\/events\/\$\{result\.createdEventId\}`\)/,
    );
  });

  it("surfaces cancel/archive/copy state on Manage Event rare actions", () => {
    expect(detail).toContain("EventRareLifecycleActions");
    expect(rare).toContain("useActionState");
    expect(rare).toContain('role="alert"');
    expect(rare).toContain("copyEventAction");
    expect(rare).toContain("cancelEventAction");
    expect(rare).toContain("archiveCancelledEventAction");
    expect(detail).not.toContain("copyEventForm");
    expect(detail).not.toContain("cancelEventForm");
    expect(detail).not.toContain("archiveCancelledEventForm");
  });

  it("surfaces discovery single-archive errors without prop-drilled Form wrappers", () => {
    expect(archiveButton).toContain("useActionState");
    expect(archiveButton).toContain("archiveCancelledEventAction");
    expect(archiveButton).toContain('role="alert"');
    expect(archiveButton).not.toContain("action.bind");
    expect(discovery).not.toContain("archiveAction");
  });

  it("leaves bulk lifecycle bar on its existing useActionState path", () => {
    expect(bulkBar).toContain("bulkCancelEvents");
    expect(bulkBar).toContain("bulkArchiveCancelledEvents");
    expect(bulkBar).toContain('role="alert"');
  });
});
