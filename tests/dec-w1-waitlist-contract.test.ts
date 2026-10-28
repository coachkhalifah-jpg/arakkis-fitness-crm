import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  WAITLIST_CAP,
  isFullForWaitlist,
  isWaitlistJoinOpen,
  waitlistCountLabel,
} from "@/lib/registration/waitlist";

const root = process.cwd();

describe("DEC-W1 capped demand waitlist", () => {
  const migration = readFileSync(
    join(root, "supabase/migrations/0091_event_demand_waitlist.sql"),
    "utf8",
  );
  const actions = readFileSync(join(root, "src/lib/registration/waitlist-actions.ts"), "utf8");
  const waitlistHelper = readFileSync(join(root, "src/lib/registration/waitlist.ts"), "utf8");
  const registerPage = readFileSync(join(root, "src/app/register/[slug]/page.tsx"), "utf8");
  const manageEvent = readFileSync(join(root, "src/app/admin/events/[id]/page.tsx"), "utf8");
  const eventsPage = readFileSync(join(root, "src/app/admin/events/page.tsx"), "utf8");
  const eventCard = readFileSync(join(root, "src/components/admin/admin-event-card.tsx"), "utf8");
  const roster = readFileSync(join(root, "src/components/admin/registration-roster.tsx"), "utf8");
  const capacityGuard = readFileSync(
    join(root, "supabase/migrations/0012_attendance_and_registration_capacity_guards.sql"),
    "utf8",
  );

  it("defines per-occurrence waitlist table with hard cap and unique contact", () => {
    expect(migration).toContain("create table public.event_waitlist_entries");
    expect(migration).toContain("event_waitlist_active_contact_uq");
    expect(migration).toContain("v_count >= 5");
    expect(migration).toContain("join_event_waitlist");
    expect(migration).toContain("remove_event_waitlist_entry");
    expect(migration).toContain("host_read_event_waitlist_entries");
    expect(migration).toContain("has_event_access(event_id)");
    expect(migration).toContain("phase7_registration_legal_allowed");
    expect(migration).toContain("no promote");
    expect(migration).not.toMatch(/admin.?promote|auto.?promote|promote_waitlist/i);
  });

  it("does not create registrations or change DEC-009 capacity floor helpers", () => {
    expect(migration).not.toMatch(/insert into public\.registrations/i);
    expect(migration).toContain("does not create registrations");
    expect(capacityGuard).toContain("enforce_active_registration_capacity");
    expect(capacityGuard).toContain("event capacity exceeded");
    expect(migration).toContain("event_waitlist_active_count");
    expect(migration).not.toMatch(
      /update public\.registrations[\s\S]{0,80}registration_status\s*=\s*'REGISTERED'/,
    );
  });

  it("mirrors production legal gate on public join action", () => {
    expect(actions).toContain("isProductionRegistrationBlocked");
    expect(actions).toContain("Interest list is temporarily unavailable while legal approval");
    expect(actions).toContain("join_event_waitlist");
    expect(actions).toContain("remove_event_waitlist_entry");
  });

  it("gates public waitlist CTA on Full and under-cap only", () => {
    expect(registerPage).toContain("isWaitlistJoinOpen");
    expect(registerPage).toContain("WaitlistJoinForm");
    expect(
      isWaitlistJoinOpen({
        availability: "FULL",
        waitlist_count: 4,
        active_registration_count: 10,
        capacity: 10,
      }),
    ).toBe(true);
    expect(
      isWaitlistJoinOpen({
        availability: "FULL",
        waitlist_count: 5,
        active_registration_count: 10,
        capacity: 10,
      }),
    ).toBe(false);
    expect(
      isWaitlistJoinOpen({
        availability: "OPEN",
        waitlist_count: 0,
        active_registration_count: 2,
        capacity: 10,
      }),
    ).toBe(false);
    expect(WAITLIST_CAP).toBe(5);
    expect(waitlistCountLabel(3)).toBe("3 on waitlist");
  });

  it("D1: Interest CTA requires public FULL availability, not mere count>=capacity", () => {
    // Helper must key off availability === FULL only (align with public Full path).
    const fullFn = waitlistHelper.slice(
      waitlistHelper.indexOf("export function isFullForWaitlist"),
      waitlistHelper.indexOf("export function isWaitlistJoinOpen"),
    );
    expect(fullFn).toContain('event.availability === "FULL"');
    expect(fullFn).not.toMatch(/active_registration_count/);
    expect(
      isFullForWaitlist({
        availability: "FULL",
        waitlist_count: 0,
        active_registration_count: 10,
        capacity: 10,
      }),
    ).toBe(true);
    for (const availability of [
      "CLOSED",
      "PAUSED",
      "CANCELLED",
      "NOT_YET_OPEN",
      "UNPUBLISHED",
      "LEGALLY_BLOCKED",
      "OPEN",
    ] as const) {
      expect(
        isWaitlistJoinOpen({
          availability,
          waitlist_count: 0,
          active_registration_count: 10,
          capacity: 10,
        }),
      ).toBe(false);
      expect(
        isFullForWaitlist({
          availability,
          waitlist_count: 0,
          active_registration_count: 10,
          capacity: 10,
        }),
      ).toBe(false);
    }
    // Missing availability must not treat seats-full alone as joinable.
    expect(
      isWaitlistJoinOpen({
        waitlist_count: 0,
        active_registration_count: 10,
        capacity: 10,
      }),
    ).toBe(false);
  });

  it("ships admin B.3 surfaces: manage list, events badge, series rollup", () => {
    expect(manageEvent).toContain("EventWaitlistPanel");
    expect(manageEvent).toContain("SeriesWaitlistRollup");
    expect(manageEvent).toContain("event_waitlist_entries");
    expect(eventsPage).toContain("waitlistCount");
    expect(eventsPage).toContain("event_waitlist_entries");
    expect(eventCard).toContain("waitlistCount");
    expect(eventCard).toContain("event-card-waitlist-badge");
  });

  it("hides misleading historical WAITLISTED roster label", () => {
    expect(roster).not.toMatch(/if \(status === "WAITLISTED"\) return "Waitlisted"/);
    expect(roster).toContain("Historical WAITLISTED label removed");
  });
});
