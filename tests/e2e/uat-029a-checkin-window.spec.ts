import { expect, test } from "@playwright/test";
import {
  createEvent,
  createRegisteredParticipant,
  localQuery,
  localSql,
  createPhase5Fixture,
  signedInClient,
  type Phase5Fixture,
} from "./phase-5-fixtures";

let fixture: Phase5Fixture;

test.beforeAll(async () => {
  fixture = await createPhase5Fixture();
});

function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function setEventTiming(
  eventId: string,
  startsAtIso: string,
  endsAtIso: string,
  deadlineIso: string,
) {
  localSql(`
    update public.events
    set starts_at = ${sqlLiteral(startsAtIso)}::timestamptz,
        ends_at = ${sqlLiteral(endsAtIso)}::timestamptz,
        registration_deadline = ${sqlLiteral(deadlineIso)}::timestamptz
    where id = ${sqlLiteral(eventId)};
  `);
}

test("UAT-029A: denies open and mark before starts_at − 30m", async () => {
  const event = createEvent(fixture, { state: "NOT_STARTED", capacity: 5 });
  const participant = createRegisteredParticipant(fixture, event.id, {
    firstName: "Early",
    lastName: `Window ${fixture.suffix}`,
  });
  const startsAt = new Date(Date.now() + 45 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  const deadline = new Date(startsAt.getTime() - 10 * 60 * 1000);
  setEventTiming(event.id, startsAt.toISOString(), endsAt.toISOString(), deadline.toISOString());

  const host = await signedInClient(fixture.hostA);
  const open = await host.rpc("phase5_open_attendance", { p_event_id: event.id });
  expect(open.error?.message ?? "").toMatch(/check-in window has not opened/i);
  expect(
    localQuery(
      `select attendance_processing_state from public.events where id=${JSON.stringify(event.id)}`,
    ),
  ).toBe("NOT_STARTED");

  const mark = await host.rpc("phase5_mark_attendance", {
    p_registration_id: participant.registrationId,
    p_status: "ATTENDED",
    p_reason: null,
  });
  expect(mark.error?.message ?? "").toMatch(/check-in window has not opened|not open/i);

  const auto = await host.rpc("phase5_auto_open_attendance_if_due", {
    p_event_id: event.id,
  });
  expect(auto.error).toBeNull();
  expect(
    localQuery(
      `select attendance_processing_state from public.events where id=${JSON.stringify(event.id)}`,
    ),
  ).toBe("NOT_STARTED");
});

test("UAT-029A: auto-opens at/after starts_at − 30m with audit", async () => {
  const event = createEvent(fixture, { state: "NOT_STARTED", capacity: 5 });
  const participant = createRegisteredParticipant(fixture, event.id, {
    firstName: "Due",
    lastName: `Window ${fixture.suffix}`,
  });
  const startsAt = new Date(Date.now() + 20 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  const deadline = new Date(startsAt.getTime() - 10 * 60 * 1000);
  setEventTiming(event.id, startsAt.toISOString(), endsAt.toISOString(), deadline.toISOString());

  const host = await signedInClient(fixture.hostA);
  const auto = await host.rpc("phase5_auto_open_attendance_if_due", {
    p_event_id: event.id,
  });
  expect(auto.error).toBeNull();
  expect(
    localQuery(
      `select attendance_processing_state from public.events where id=${JSON.stringify(event.id)}`,
    ),
  ).toBe("OPEN");
  expect(
    localQuery(
      `select count(*) from public.audit_events where entity_id=${JSON.stringify(event.id)} and action='ATTENDANCE_OPENED' and new_values->>'source'='AUTO'`,
    ),
  ).toBe("1");

  const mark = await host.rpc("phase5_mark_attendance", {
    p_registration_id: participant.registrationId,
    p_status: "ATTENDED",
    p_reason: null,
  });
  expect(mark.error).toBeNull();
});

test("UAT-029A: cancelled events stay blocked; batch reconcile opens due events", async () => {
  const cancelled = createEvent(fixture, {
    state: "NOT_STARTED",
    status: "CANCELLED",
    capacity: 5,
  });
  const due = createEvent(fixture, { state: "NOT_STARTED", capacity: 5 });
  const early = createEvent(fixture, { state: "NOT_STARTED", capacity: 5 });

  const dueStart = new Date(Date.now() + 10 * 60 * 1000);
  const earlyStart = new Date(Date.now() + 90 * 60 * 1000);
  for (const [id, start] of [
    [cancelled.id, dueStart],
    [due.id, dueStart],
    [early.id, earlyStart],
  ] as const) {
    setEventTiming(
      id,
      start.toISOString(),
      new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
      new Date(start.getTime() - 5 * 60 * 1000).toISOString(),
    );
  }

  const host = await signedInClient(fixture.hostA);
  const cancelledOpen = await host.rpc("phase5_auto_open_attendance_if_due", {
    p_event_id: cancelled.id,
  });
  expect(cancelledOpen.error?.message ?? "").toMatch(/unavailable|forbidden|42501/i);

  const batch = await host.rpc("phase5_reconcile_due_attendance_opens");
  expect(batch.error).toBeNull();
  expect(Number(batch.data)).toBeGreaterThanOrEqual(1);

  expect(
    localQuery(
      `select attendance_processing_state from public.events where id=${JSON.stringify(due.id)}`,
    ),
  ).toBe("OPEN");
  expect(
    localQuery(
      `select attendance_processing_state from public.events where id=${JSON.stringify(early.id)}`,
    ),
  ).toBe("NOT_STARTED");
  expect(
    localQuery(
      `select attendance_processing_state from public.events where id=${JSON.stringify(cancelled.id)}`,
    ),
  ).toBe("NOT_STARTED");
});
