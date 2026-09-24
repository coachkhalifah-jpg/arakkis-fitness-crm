import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0075_participant_manage_recovery_links.sql"),
  "utf8",
);

describe("participant manage recovery migration contract", () => {
  it("stores hash-only recovery links with System Admin issue/revoke and public consume grants", () => {
    expect(migration).toContain("create table public.participant_manage_recovery_links");
    expect(migration).toContain("token_hash bytea not null unique");
    expect(migration).toContain("participant_manage_recovery_one_pending_idx");
    expect(migration).toContain("PARTICIPANT_MANAGE_RECOVERY_ISSUED");
    expect(migration).toContain("PARTICIPANT_MANAGE_RECOVERY_REGENERATED");
    expect(migration).toContain("PARTICIPANT_MANAGE_RECOVERY_REVOKED");
    expect(migration).toContain("PARTICIPANT_MANAGE_RECOVERY_CONSUMED");
    expect(migration).toContain("participant_remembered_devices");
    expect(migration).toContain("digest(v_raw, 'sha256')");
    expect(migration).toMatch(
      /grant execute on function public\.issue_participant_manage_recovery_link\(uuid, bytea, timestamptz, uuid\)\s+to service_role/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.revoke_participant_manage_recovery_link\(uuid, uuid\)\s+to service_role/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.consume_participant_manage_recovery_link\(text\)\s+to anon,\s*authenticated,\s*service_role/,
    );
    expect(migration).toContain(
      "revoke all on function public.issue_participant_manage_recovery_link(uuid, bytea, timestamptz, uuid)\n  from public, anon, authenticated;",
    );
    expect(migration).toContain("revoke all on public.participant_manage_recovery_links from anon");
  });

  it("does not persist raw recovery tokens in the table or audit payloads", () => {
    expect(migration).not.toMatch(/raw_token|token_plain|plaintext/);
    expect(migration).toContain("token_hash bytea not null unique");
    // Issue/revoke/consume audits reference participant_id (and device_id on consume), never the bearer.
    expect(migration).toMatch(
      /PARTICIPANT_MANAGE_RECOVERY_ISSUED[\s\S]*jsonb_build_object\(\s*'participant_id'/,
    );
    expect(migration).toMatch(
      /PARTICIPANT_MANAGE_RECOVERY_CONSUMED[\s\S]*jsonb_build_object\(\s*'participant_id'[\s\S]*'device_id'/,
    );
  });
});
