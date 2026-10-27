import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd());

describe("DEC-073 / DEC-074 event bulk lifecycle + lean delete", () => {
  const migration = readFileSync(
    join(root, "supabase/migrations/0085_event_bulk_lifecycle_and_lean_delete.sql"),
    "utf8",
  );
  const bypassMigration = readFileSync(
    join(root, "supabase/migrations/0089_lean_event_delete_trigger_bypass.sql"),
    "utf8",
  );
  const hostedBypassMigration = readFileSync(
    join(root, "supabase/migrations/0090_lean_delete_guc_bypass.sql"),
    "utf8",
  );
  const discovery = readFileSync(
    join(root, "src/components/admin/admin-events-discovery.tsx"),
    "utf8",
  );
  const actions = readFileSync(join(root, "src/lib/services/phase-3-actions.ts"), "utf8");
  const detail = readFileSync(join(root, "src/app/admin/events/[id]/page.tsx"), "utf8");
  const bulkBar = readFileSync(
    join(root, "src/components/admin/events-bulk-lifecycle-bar.tsx"),
    "utf8",
  );
  const leanForm = readFileSync(
    join(root, "src/components/admin/event-delete-lean-form.tsx"),
    "utf8",
  );
  const opsCss = readFileSync(join(root, "src/app/admin/ops.css"), "utf8");

  it("defines System Admin lean-delete RPC with durable-history guards", () => {
    expect(migration).toContain("phase3_delete_lean_event");
    expect(migration).toContain("is_active_system_admin()");
    expect(migration).toContain("EVENT_DELETED_LEAN");
    expect(migration).toContain("registrations");
    expect(migration).toContain("cancellation history");
    expect(migration).toContain("delete from public.design_assets");
  });

  it("bypasses archive-not-delete triggers via session_replication_role=replica (0089)", () => {
    expect(bypassMigration).toContain("phase3_delete_lean_event");
    expect(bypassMigration).toContain("session_replication_role");
    expect(bypassMigration).toContain("'replica'");
    expect(bypassMigration).toMatch(
      /EVENT_DELETED_LEAN[\s\S]*session_replication_role[\s\S]*delete from public\.events/,
    );
    expect(bypassMigration).toContain("cancellation history");
    expect(bypassMigration).toContain("cannot permanently delete");
  });

  it("uses hosted-safe arakkis.allow_application_delete GUC (0090), not session_replication_role", () => {
    expect(hostedBypassMigration).toContain("prevent_application_delete");
    expect(hostedBypassMigration).toContain("arakkis.allow_application_delete");
    expect(hostedBypassMigration).toContain("return OLD");
    expect(hostedBypassMigration).toContain("phase3_delete_lean_event");
    expect(hostedBypassMigration).toContain("phase6_force_delete_participant");
    expect(hostedBypassMigration).not.toContain("session_replication_role");
    expect(hostedBypassMigration).toMatch(
      /EVENT_DELETED_LEAN[\s\S]*arakkis\.allow_application_delete[\s\S]*delete from public\.events/,
    );
    expect(hostedBypassMigration).toContain("cancellation history");
    expect(hostedBypassMigration).toContain("cannot permanently delete");
    expect(hostedBypassMigration).toContain("PARTICIPANT_DELETED_FORCE");
    expect(hostedBypassMigration).toContain("application records are archived, not deleted");
  });

  it("matches series-action hover for bulk lifecycle bar actions", () => {
    const globalsCss = readFileSync(join(root, "src/app/globals.css"), "utf8");
    expect(globalsCss).toContain(
      ".admin-events-page .admin-events-bulk-bar-actions .admin-series-action:not(:disabled):hover",
    );
    expect(globalsCss).toContain(
      ".admin-events-page .admin-events-bulk-bar-actions .admin-series-action-subordinate:not(:disabled):hover",
    );
    expect(globalsCss).toMatch(
      /\.admin-events-bulk-bar-actions[\s\S]*#f28a4b[\s\S]*#e5484d/,
    );
  });

  it("wires bulk cancel/archive/lean-delete actions", () => {
    expect(actions).toContain("bulkCancelEvents");
    expect(actions).toContain("bulkArchiveCancelledEvents");
    expect(actions).toContain("bulkDeleteLeanEvents");
    expect(actions).toContain("deleteLeanEvent");
    expect(actions).toContain("phase3_delete_lean_event");
  });

  it("exposes discovery selection + bulk bar for System Admin", () => {
    expect(discovery).toContain("canBulkManage");
    expect(discovery).toContain("EventsBulkLifecycleBar");
    expect(discovery).toContain("Done selecting");
    expect(discovery).toContain("selectionMode");
    expect(discovery).toContain("selectedIds.length > 0");
  });

  it("exposes lean delete on event detail rare actions", () => {
    expect(detail).toContain("EventDeleteLeanForm");
  });

  it("refreshes discovery and closes the sheet after bulk lifecycle success", () => {
    expect(bulkBar).toContain("useRouter");
    expect(bulkBar).toContain("router.refresh()");
    expect(bulkBar).toContain("sheetOpen");
    expect(bulkBar).toContain("modeSucceeded");
    expect(bulkBar).toContain('role="alert"');
    expect(bulkBar).toContain("bulkDeleteLeanEvents");
  });

  it("keeps single lean-delete redirect and surfaces errors in the sheet", () => {
    expect(actions).toMatch(
      /export async function deleteLeanEvent[\s\S]*?redirect\("\/admin\/events"\)/,
    );
    expect(leanForm).toContain("PeopleDestructiveActionSheet");
    expect(leanForm).toContain('role="alert"');
    expect(leanForm).toContain("ops-people-profile-archive");
  });

  it("spaces destructive-sheet lean-delete reason above the submit control", () => {
    expect(opsCss).toMatch(
      /\.ops-people-destructive-sheet\s+\.ops-people-profile-archive\s*\{[^}]*display:\s*grid;[^}]*gap:\s*1rem;/,
    );
    expect(opsCss).toContain(".ops-people-destructive-sheet .ops-people-profile-archive-reason");
  });
});
