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
