import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DEC-069 participant archive (Remove from People)", () => {
  it("ships migration 0082 soft-archive RPC with upcoming-booking guard", () => {
    const migration = readFileSync("supabase/migrations/0082_archive_participant.sql", "utf8");
    expect(migration).toContain("phase6_archive_participant");
    expect(migration).toContain("status = 'ARCHIVED'");
    expect(migration).toContain("cancel upcoming bookings before removing this person");
    expect(migration).toContain("PARTICIPANT_ARCHIVED");
    expect(migration).toContain("REVOKED");
    expect(migration).not.toContain("delete from public.participants");
  });

  it("wires archive action and profile form", () => {
    const actions = readFileSync("src/lib/services/phase-6-actions.ts", "utf8");
    const form = readFileSync("src/components/admin/participant-archive-form.tsx", "utf8");
    expect(actions).toContain("export async function archiveParticipant");
    expect(actions).toContain('redirect("/admin/participants")');
    expect(form).toContain('data-testid="participant-archive"');
    expect(form).toContain("Remove from People");
  });
});

describe("DEC-070 lean permanent delete", () => {
  it("ships migration 0083 lean-delete RPC that blocks durable history", () => {
    const migration = readFileSync("supabase/migrations/0083_delete_lean_participant.sql", "utf8");
    expect(migration).toContain("phase6_delete_lean_participant");
    expect(migration).toContain("cannot permanently delete");
    expect(migration).toContain("PARTICIPANT_DELETED_LEAN");
    expect(migration).toContain("delete from public.participants");
    expect(migration).toContain("registrations");
    expect(migration).toContain("follow_up_tasks");
    expect(migration).toContain("participant_notes");
  });

  it("wires lean-delete action and profile form", () => {
    const actions = readFileSync("src/lib/services/phase-6-actions.ts", "utf8");
    const form = readFileSync("src/components/admin/participant-delete-lean-form.tsx", "utf8");
    const profile = readFileSync("src/app/admin/participants/[id]/page.tsx", "utf8");
    expect(actions).toContain("export async function deleteLeanParticipant");
    expect(form).toContain('data-testid="participant-delete-lean"');
    expect(form).toContain("Delete permanently");
    expect(profile).toContain("<ParticipantDeleteLeanForm");
  });
});

describe("DEC-071 force delete with history", () => {
  it("ships migration 0084 force-delete cascade RPC", () => {
    const migration = readFileSync(
      "supabase/migrations/0084_force_delete_and_reactivate_archived.sql",
      "utf8",
    );
    expect(migration).toContain("phase6_force_delete_participant");
    expect(migration).toContain("PARTICIPANT_DELETED_FORCE");
    expect(migration).toContain("session_replication_role");
    expect(migration).toContain("delete from public.registrations");
    expect(migration).toContain("delete from public.acknowledgment_acceptances");
    expect(migration).toContain("delete from public.participants");
  });

  it("replaces force-delete bypass with hosted-safe GUC in 0090", () => {
    const migration = readFileSync("supabase/migrations/0090_lean_delete_guc_bypass.sql", "utf8");
    expect(migration).toContain("phase6_force_delete_participant");
    expect(migration).toContain("arakkis.allow_application_delete");
    expect(migration).not.toMatch(/set_config\(\s*'session_replication_role'/);
    expect(migration).toContain("PARTICIPANT_DELETED_FORCE");
    expect(migration).toContain("delete from public.participants");
  });

  it("wires force-delete action and profile form", () => {
    const actions = readFileSync("src/lib/services/phase-6-actions.ts", "utf8");
    const form = readFileSync("src/components/admin/participant-force-delete-form.tsx", "utf8");
    const profile = readFileSync("src/app/admin/participants/[id]/page.tsx", "utf8");
    expect(actions).toContain("export async function forceDeleteParticipant");
    expect(form).toContain('data-testid="participant-force-delete"');
    expect(form).toContain("Force delete with history");
    expect(profile).toContain("<ParticipantForceDeleteForm");
  });
});

describe("DEC-072 reactivate ARCHIVED on phone match", () => {
  it("updates public registration and walk-in match to reactivate ARCHIVED", () => {
    const migration = readFileSync(
      "supabase/migrations/0084_force_delete_and_reactivate_archived.sql",
      "utf8",
    );
    expect(migration).toContain("PARTICIPANT_REACTIVATED_ON_REGISTRATION");
    expect(migration).toContain("status='ARCHIVED'");
    expect(migration).toContain("set status='ACTIVE'");
    expect(migration).toContain("register_selected_events_with_legal");
    expect(migration).toContain("phase5_create_walk_in");
  });
});
