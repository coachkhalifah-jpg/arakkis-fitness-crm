import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0074_remembered_device_resolve_anon_execute.sql"),
  "utf8",
);

describe("remembered device resolve anon execute contract", () => {
  it("grants device-capability resolve and booking RPCs to anon and authenticated", () => {
    for (const fn of [
      "phase10_resolve_participant_device_token(text)",
      "phase10_revoke_participant_device(text)",
      "get_participant_upcoming_bookings(text)",
      "get_participant_booking_alternatives(text, uuid)",
      "manage_participant_booking(text, text, uuid, uuid)",
      "phase10_issue_participant_confirmation_token(text, uuid)",
    ]) {
      expect(migration).toContain(`grant execute on function public.${fn}`);
    }
    expect(migration).toMatch(/to anon,\s*authenticated/);
  });
});
