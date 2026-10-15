import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd());

describe("DEC-073 / DEC-074 event bulk lifecycle + lean delete", () => {
  const migration = readFileSync(
    join(root, "supabase/migrations/0085_event_bulk_lifecycle_and_lean_delete.sql"),
    "utf8",
  );
  const discovery = readFileSync(
    join(root, "src/components/admin/admin-events-discovery.tsx"),
    "utf8",
  );
  const actions = readFileSync(join(root, "src/lib/services/phase-3-actions.ts"), "utf8");
  const detail = readFileSync(join(root, "src/app/admin/events/[id]/page.tsx"), "utf8");

  it("defines System Admin lean-delete RPC with durable-history guards", () => {
    expect(migration).toContain("phase3_delete_lean_event");
    expect(migration).toContain("is_active_system_admin()");
    expect(migration).toContain("EVENT_DELETED_LEAN");
    expect(migration).toContain("registrations");
    expect(migration).toContain("cancellation history");
    expect(migration).toContain("delete from public.design_assets");
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
  });

  it("exposes lean delete on event detail rare actions", () => {
    expect(detail).toContain("EventDeleteLeanForm");
  });
});
