import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createEvent,
  createPhase5Fixture,
  createRegisteredParticipant,
  localQuery,
  openAttendance,
  signInPage,
  signedInClient,
  walkInArgs,
  type Phase5Fixture,
} from "./phase-5-fixtures";

test.describe.configure({ mode: "serial" });

let fixture: Phase5Fixture;

test.beforeAll(async () => {
  fixture = await createPhase5Fixture();
});

async function openEventInBrowser(page: Page, eventId: string, identity = fixture.hostA) {
  await signInPage(page, identity, `/admin/events/${eventId}`);
  await expect(page).toHaveURL(new RegExp(`/admin/events/${eventId}`));
}

async function invokeWalkIn(
  client: SupabaseClient,
  eventId: string,
  firstName: string,
  lastName: string,
  phone: string,
  overrideReason: string | null = null,
  email?: string,
) {
  return client.rpc(
    "phase5_create_walk_in",
    walkInArgs(fixture, eventId, firstName, lastName, phone, overrideReason, email),
  );
}

test("registered check-in persists, is idempotent, and records actor/time/audit evidence", async ({
  page,
}) => {
  const event = createEvent(fixture);
  const participant = createRegisteredParticipant(fixture, event.id, {
    firstName: "Registered",
    lastName: `Checkin ${fixture.suffix}`,
  });
  await openEventInBrowser(page, event.id);

  await page.getByRole("button", { name: "Start check-in" }).click();
  const row = page.getByRole("row").filter({ hasText: participant.firstName });
  await expect(row.getByText("NOT_RECORDED")).toBeVisible();
  await row.getByRole("button", { name: "Check in" }).click();
  await expect(row.getByText("ATTENDED", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: participant.firstName })
      .getByText("ATTENDED", { exact: true }),
  ).toBeVisible();

  const attendanceId = localQuery(
    `select id from public.attendance where registration_id=${JSON.stringify(participant.registrationId)}`,
  );
  expect(attendanceId).toMatch(/^[0-9a-f-]{36}$/);
  expect(
    localQuery(
      `select count(*) from public.attendance where registration_id=${JSON.stringify(participant.registrationId)}`,
    ),
  ).toBe("1");
  expect(
    localQuery(
      `select updated_by_admin_id from public.attendance where id=${JSON.stringify(attendanceId)}`,
    ),
  ).toBe(fixture.hostA.id);
  expect(
    localQuery(
      `select count(*) from public.attendance_transitions where attendance_id=${JSON.stringify(attendanceId)} and to_status='ATTENDED'`,
    ),
  ).toBe("1");
  expect(
    localQuery(
      `select count(*) from public.audit_events where entity_id=${JSON.stringify(attendanceId)} and action='ATTENDANCE_MARKED' and actor_admin_id=${JSON.stringify(fixture.hostA.id)}`,
    ),
  ).toBe("1");
  expect(
    localQuery(
      `select checked_in_at is not null and updated_at is not null from public.attendance where id=${JSON.stringify(attendanceId)}`,
    ),
  ).toBe("t");

  await page.reload();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: participant.firstName })
      .getByText("ATTENDED", { exact: true }),
  ).toBeVisible();
  expect(
    localQuery(
      `select count(*) from public.attendance where registration_id=${JSON.stringify(participant.registrationId)}`,
    ),
  ).toBe("1");
  expect(
    localQuery(
      `select count(*) from public.attendance_transitions where attendance_id=${JSON.stringify(attendanceId)}`,
    ),
  ).toBe("1");
});

test("walk-in reuses exact matches, creates new records transactionally, and preserves conservative matching", async () => {
  const event = createEvent(fixture, { state: "OPEN", capacity: 10 });
  const existing = createRegisteredParticipant(fixture, event.id, {
    firstName: "Exact",
    lastName: `Match ${fixture.suffix}`,
    phone: "+15185550101",
    email: "match@example.test",
  });
  const client = await signedInClient(fixture.hostA);

  const reused = await invokeWalkIn(
    client,
    event.id,
    `Exact`,
    `Match ${fixture.suffix}`,
    "+15185550101",
  );
  expect(reused.error).toBeNull();
  expect((reused.data as { existing_registration: boolean }).existing_registration).toBe(true);
  expect(
    localQuery(
      `select count(*) from public.participants where id=${JSON.stringify(existing.participantId)}`,
    ),
  ).toBe("1");
  expect(
    localQuery(
      `select count(*) from public.registrations where participant_id=${JSON.stringify(existing.participantId)} and event_id=${JSON.stringify(event.id)} and registration_status='REGISTERED'`,
    ),
  ).toBe("1");
  expect(
    localQuery(
      `select submission_source from public.registration_groups where id=(select registration_group_id from public.registrations where id=${JSON.stringify(existing.registrationId)})`,
    ),
  ).toBe("PUBLIC");
  expect(
    localQuery(
      `select status from public.attendance where registration_id=${JSON.stringify(existing.registrationId)}`,
    ),
  ).toBe("ATTENDED");
  expect(
    localQuery(
      `select count(*) from public.audit_events where action='WALK_IN_REGISTRATION_CREATED' and entity_id=${JSON.stringify(existing.registrationId)}`,
    ),
  ).toBe("0");

  const created = await invokeWalkIn(
    client,
    event.id,
    "New Walkin",
    fixture.suffix,
    "+15185550102",
  );
  expect(created.error).toBeNull();
  const createdRegistration = (created.data as { registration_id: string }).registration_id;
  expect(
    localQuery(
      `select count(distinct p.id) from public.participants p join public.registrations r on r.participant_id=p.id where r.event_id=${JSON.stringify(event.id)} and p.normalized_phone='+15185550102'`,
    ),
  ).toBe("1");
  expect(
    localQuery(
      `select count(*) from public.registrations where id=${JSON.stringify(createdRegistration)} and registration_status='REGISTERED' and registration_outcome='ACTIVE'`,
    ),
  ).toBe("1");
  expect(
    localQuery(
      `select submission_source from public.registration_groups where id=(select registration_group_id from public.registrations where id=${JSON.stringify(createdRegistration)})`,
    ),
  ).toBe("WALK_IN");
  expect(
    localQuery(
      `select status from public.attendance where registration_id=${JSON.stringify(createdRegistration)}`,
    ),
  ).toBe("ATTENDED");
  expect(
    localQuery(
      `select count(*) from public.acknowledgment_acceptances where registration_group_id=(select registration_group_id from public.registrations where id=${JSON.stringify(createdRegistration)})`,
    ),
  ).toBe("2");

  const phoneOnly = await invokeWalkIn(
    client,
    event.id,
    "Different Name",
    fixture.suffix,
    "+15185550101",
  );
  expect(phoneOnly.error).toBeNull();
  expect(
    localQuery(
      `select count(distinct p.id) from public.participants p join public.registrations r on r.participant_id=p.id where r.event_id=${JSON.stringify(event.id)} and p.normalized_phone='+15185550101'`,
    ),
  ).toBe("2");
  const emailOnly = await invokeWalkIn(
    client,
    event.id,
    "Email Only",
    fixture.suffix,
    "+15185550103",
    null,
    "match@example.test",
  );
  expect(emailOnly.error).toBeNull();
  expect(
    localQuery(
      `select count(distinct p.id) from public.participants p join public.registrations r on r.participant_id=p.id where r.event_id=${JSON.stringify(event.id)} and p.normalized_email='match@example.test'`,
    ),
  ).toBe("2");
});

test("browser walk-in creates one participant, registration, attendance, and visible roster row", async ({
  page,
}) => {
  const event = createEvent(fixture, { state: "OPEN", capacity: 10 });
  await openEventInBrowser(page, event.id);
  const phoneSuffix = String(
    1000 + (Number.parseInt(fixture.suffix.slice(-4), 16) % 8999),
  ).padStart(4, "0");
  const normalizedPhone = `+1518867${phoneSuffix}`;

  await page.getByLabel("First name").fill("Browser");
  await page.getByLabel("Last name").fill(`Walkin ${fixture.suffix}`);
  await page.getByLabel("Phone").fill(`+1 518-867-${phoneSuffix}`);
  await page.getByLabel("Email").fill(`browser-walkin-${fixture.suffix}@example.test`);
  await page.getByRole("button", { name: "Add Walk-In & Check In" }).click();

  await expect(page.getByRole("status")).toContainText("Walk-in checked in.");
  await page.reload();
  const row = page.getByRole("row").filter({ hasText: "Browser Walkin" });
  await expect(row).toContainText("ATTENDED");

  expect(
    localQuery(
      `select count(*) from public.participants where normalized_phone=${JSON.stringify(normalizedPhone)}`,
    ),
  ).toBe("1");
  expect(
    localQuery(
      `select count(*) from public.registrations r join public.participants p on p.id=r.participant_id where r.event_id=${JSON.stringify(event.id)} and p.normalized_phone=${JSON.stringify(normalizedPhone)} and r.registration_status='REGISTERED' and r.registration_outcome='ACTIVE'`,
    ),
  ).toBe("1");
  expect(
    localQuery(
      `select count(*) from public.attendance a join public.registrations r on r.id=a.registration_id join public.participants p on p.id=r.participant_id where r.event_id=${JSON.stringify(event.id)} and p.normalized_phone=${JSON.stringify(normalizedPhone)} and a.status='ATTENDED'`,
    ),
  ).toBe("1");
});

test("full-event walk-in fails safely and three final-spot competitions never exceed capacity", async () => {
  const client = await signedInClient(fixture.hostA);
  const full = createEvent(fixture, { state: "OPEN", capacity: 1 });
  createRegisteredParticipant(fixture, full.id);
  const failed = await invokeWalkIn(client, full.id, "Full Event", fixture.suffix, "+15185550200");
  expect(failed.data).toBeNull();
  expect(failed.error?.message).toMatch(/capacity/i);
  expect(
    localQuery(
      `select count(*) from public.registrations where event_id=${JSON.stringify(full.id)} and registration_status='REGISTERED' and registration_outcome='ACTIVE'`,
    ),
  ).toBe("1");
  expect(
    localQuery(
      `select count(distinct p.id) from public.participants p join public.registrations r on r.participant_id=p.id where r.event_id=${JSON.stringify(full.id)} and p.normalized_phone='+15185550200'`,
    ),
  ).toBe("0");
  expect(
    localQuery(
      `select count(*) from public.registration_groups g where g.participant_id in (select p.id from public.participants p join public.registrations r on r.participant_id=p.id where r.event_id=${JSON.stringify(full.id)} and p.normalized_phone='+15185550200')`,
    ),
  ).toBe("0");

  for (let repetition = 0; repetition < 3; repetition += 1) {
    const event = createEvent(fixture, {
      state: "OPEN",
      capacity: 2,
      name: `Phase 5 final spot ${repetition} ${fixture.suffix}`,
    });
    createRegisteredParticipant(fixture, event.id, {
      firstName: "Capacity",
      lastName: `Seed${repetition}`,
      phone: `+1518555030${repetition}`,
    });
    const first = signedInClient(fixture.hostA);
    const second = signedInClient(fixture.hostA);
    const [one, two] = await Promise.all([first, second]);
    const results = await Promise.all([
      invokeWalkIn(
        one,
        event.id,
        `Race One ${repetition}`,
        fixture.suffix,
        `+1518555040${repetition}`,
      ),
      invokeWalkIn(
        two,
        event.id,
        `Race Two ${repetition}`,
        fixture.suffix,
        `+1518555050${repetition}`,
      ),
    ]);
    expect(results.filter((result) => !result.error)).toHaveLength(1);
    expect(results.filter((result) => result.error?.message.match(/capacity/i))).toHaveLength(1);
    expect(
      localQuery(
        `select count(*) from public.registrations where event_id=${JSON.stringify(event.id)} and registration_status='REGISTERED' and registration_outcome='ACTIVE'`,
      ),
    ).toBe("2");
    expect(
      localQuery(
        `select count(*) from public.attendance a join public.registrations r on r.id=a.registration_id where r.event_id=${JSON.stringify(event.id)} and a.status='ATTENDED'`,
      ),
    ).toBe("1");
    expect(
      localQuery(
        `select count(*) from public.registration_groups g where g.participant_id in (select id from public.participants where last_name=${JSON.stringify(fixture.suffix)}) and not exists (select 1 from public.registrations r where r.registration_group_id=g.id)`,
      ),
    ).toBe("0");
  }
});

test("finalization converts only eligible unmarked registrations, is idempotent, and enforces reopening/correction authority", async ({
  page,
}) => {
  const event = createEvent(fixture, { state: "NOT_STARTED", capacity: 5 });
  const attended = createRegisteredParticipant(fixture, event.id, {
    firstName: "Already",
    lastName: `Attended ${fixture.suffix}`,
  });
  const unchecked = createRegisteredParticipant(fixture, event.id, {
    firstName: "Will",
    lastName: `NoShow ${fixture.suffix}`,
  });
  const cancelled = createRegisteredParticipant(fixture, event.id, {
    firstName: "Cancelled",
    lastName: `Registration ${fixture.suffix}`,
    status: "CANCELLED",
    outcome: "PARTICIPANT_CANCELLED",
  });
  const host = await signedInClient(fixture.hostA);
  await openAttendance(host, event.id);
  await host.rpc("phase5_mark_attendance", {
    p_registration_id: attended.registrationId,
    p_status: "ATTENDED",
    p_reason: null,
  });
  await openEventInBrowser(page, event.id, fixture.hostA);
  await expect(page.getByRole("button", { name: "Finalize Attendance" })).toHaveCount(0);
  await openEventInBrowser(page, event.id, fixture.system);
  await expect(page.getByRole("button", { name: "Finalize Attendance" })).toBeVisible();
  const before = await host.rpc("phase5_mark_attendance", {
    p_registration_id: unchecked.registrationId,
    p_status: "NO_SHOW",
    p_reason: null,
  });
  expect(before.error?.message).toMatch(/finalization/i);
  const system = await signedInClient(fixture.system);
  const finalized = await system.rpc("phase5_finalize_attendance", { p_event_id: event.id });
  expect(finalized.error).toBeNull();
  expect(
    localQuery(
      `select status from public.attendance where registration_id=${JSON.stringify(attended.registrationId)}`,
    ),
  ).toBe("ATTENDED");
  expect(
    localQuery(
      `select status from public.attendance where registration_id=${JSON.stringify(unchecked.registrationId)}`,
    ),
  ).toBe("NO_SHOW");
  expect(
    localQuery(
      `select count(*) from public.attendance where registration_id=${JSON.stringify(cancelled.registrationId)}`,
    ),
  ).toBe("0");
  expect(
    localQuery(
      `select count(*) from public.audit_events where entity_id=${JSON.stringify(event.id)} and action='ATTENDANCE_FINALIZED'`,
    ),
  ).toBe("1");
  const hostCorrection = await host.rpc("phase5_mark_attendance", {
    p_registration_id: unchecked.registrationId,
    p_status: "ATTENDED",
    p_reason: "Host post-finalization attempt",
  });
  expect(hostCorrection.error).toBeNull();
  expect(
    localQuery(
      `select status from public.attendance where registration_id=${JSON.stringify(unchecked.registrationId)}`,
    ),
  ).toBe("ATTENDED");
  expect(
    localQuery(
      `select count(*) from public.audit_events where entity_id=(select id from public.attendance where registration_id=${JSON.stringify(unchecked.registrationId)}) and actor_admin_id=${JSON.stringify(fixture.hostA.id)} and reason='Host post-finalization attempt'`,
    ),
  ).toBe("1");
  await openEventInBrowser(page, event.id, fixture.hostA);
  await expect(
    page.getByText(/Authorized Host Admins may correct individual results/),
  ).toBeVisible();
  await expect(page.getByLabel("Correction reason")).toHaveCount(1);
  const unauthorizedFinalize = await host.rpc("phase5_finalize_attendance", {
    p_event_id: event.id,
  });
  expect(unauthorizedFinalize.error?.message).toMatch(/forbidden|event unavailable/i);
  const idempotentFinalize = await system.rpc("phase5_finalize_attendance", {
    p_event_id: event.id,
  });
  expect(idempotentFinalize.error).toBeNull();
  expect(
    localQuery(
      `select count(*) from public.audit_events where entity_id=${JSON.stringify(event.id)} and action='ATTENDANCE_FINALIZED'`,
    ),
  ).toBe("1");

  const unauthorizedReopen = await host.rpc("phase5_reopen_attendance", {
    p_event_id: event.id,
    p_reason: "Host attempt",
  });
  expect(unauthorizedReopen.error?.message).toMatch(/forbidden|event unavailable/i);
  const blankReason = await system.rpc("phase5_reopen_attendance", {
    p_event_id: event.id,
    p_reason: "",
  });
  expect(blankReason.error?.message).toMatch(/reason/i);
  const reopened = await system.rpc("phase5_reopen_attendance", {
    p_event_id: event.id,
    p_reason: "Correct attendance fixture",
  });
  expect(reopened.error).toBeNull();
  const blankCorrection = await system.rpc("phase5_mark_attendance", {
    p_registration_id: unchecked.registrationId,
    p_status: "ATTENDED",
    p_reason: null,
  });
  expect(blankCorrection.error?.message).toMatch(/reason/i);
  const correction = await system.rpc("phase5_mark_attendance", {
    p_registration_id: unchecked.registrationId,
    p_status: "ATTENDED",
    p_reason: "Participant arrived; finalization record corrected.",
  });
  expect(correction.error).toBeNull();
  expect(
    localQuery(
      `select status from public.attendance where registration_id=${JSON.stringify(unchecked.registrationId)}`,
    ),
  ).toBe("ATTENDED");
  expect(
    localQuery(
      `select count(*) from public.attendance_transitions where attendance_id=(select id from public.attendance where registration_id=${JSON.stringify(unchecked.registrationId)}) and from_status='NO_SHOW' and to_status='ATTENDED'`,
    ),
  ).toBe("1");
  expect(
    localQuery(
      `select count(*) from public.audit_events where entity_id=(select id from public.attendance where registration_id=${JSON.stringify(unchecked.registrationId)}) and reason='Participant arrived; finalization record corrected.'`,
    ),
  ).toBe("1");

  await openEventInBrowser(page, event.id, fixture.hostA);
  await expect(page.getByText(/REOPENED/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Reopen" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Checked in" })).toHaveCount(2);
});

test("direct RPC authorization and organization isolation deny every unauthorized Phase 5 mutation", async () => {
  const eventA = createEvent(fixture, { state: "OPEN" });
  const eventB = createEvent(fixture, { organizationId: fixture.organizationB, state: "OPEN" });
  const registrationA = createRegisteredParticipant(fixture, eventA.id);
  const registrationB = createRegisteredParticipant(fixture, eventB.id);
  const hostA = await signedInClient(fixture.hostA);
  const hostB = await signedInClient(fixture.hostB);
  const system = await signedInClient(fixture.system);
  const nonAdmin = await signedInClient(fixture.nonAdmin);
  const inactive = await signedInClient(fixture.inactive);
  const anonymous = (await import("./phase-5-fixtures")).adminClient();

  expect((await hostA.rpc("phase5_open_attendance", { p_event_id: eventA.id })).error).toBeNull();
  expect(
    (await hostA.rpc("phase5_open_attendance", { p_event_id: eventB.id })).error,
  ).not.toBeNull();
  const hostFinalize = await hostA.rpc("phase5_finalize_attendance", { p_event_id: eventA.id });
  expect(hostFinalize.error?.message).toMatch(/forbidden|event unavailable/i);
  expect(
    localQuery(
      `select attendance_processing_state from public.events where id=${JSON.stringify(eventA.id)}`,
    ),
  ).toBe("OPEN");
  const systemFinalize = await system.rpc("phase5_finalize_attendance", { p_event_id: eventA.id });
  expect(systemFinalize.error).toBeNull();
  expect(
    localQuery(
      `select attendance_processing_state from public.events where id=${JSON.stringify(eventA.id)}`,
    ),
  ).toBe("FINALIZED");
  expect(
    (
      await hostA.rpc("phase5_mark_attendance", {
        p_registration_id: registrationB.registrationId,
        p_status: "ATTENDED",
        p_reason: null,
      })
    ).error,
  ).not.toBeNull();
  expect(
    (
      await hostA.rpc(
        "phase5_create_walk_in",
        walkInArgs(fixture, eventB.id, "Leak", fixture.suffix, "+15185550999"),
      )
    ).error,
  ).not.toBeNull();
  expect(
    (await hostA.rpc("phase5_finalize_attendance", { p_event_id: eventB.id })).error,
  ).not.toBeNull();
  expect(
    (
      await hostA.rpc("phase5_reopen_attendance", {
        p_event_id: eventA.id,
        p_reason: "Not allowed",
      })
    ).error,
  ).not.toBeNull();
  for (const client of [nonAdmin, inactive, anonymous]) {
    expect(
      (await client.rpc("phase5_open_attendance", { p_event_id: eventA.id })).error,
    ).not.toBeNull();
    expect(
      (
        await client.rpc("phase5_mark_attendance", {
          p_registration_id: registrationA.registrationId,
          p_status: "ATTENDED",
          p_reason: null,
        })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await client.rpc(
          "phase5_create_walk_in",
          walkInArgs(
            fixture,
            eventA.id,
            "Unauthorized",
            fixture.suffix,
            `+151855508${Math.floor(Math.random() * 90 + 10)}`,
          ),
        )
      ).error,
    ).not.toBeNull();
    expect(
      (await client.rpc("phase5_finalize_attendance", { p_event_id: eventA.id })).error,
    ).not.toBeNull();
    expect(
      (
        await client.rpc("phase5_reopen_attendance", {
          p_event_id: eventA.id,
          p_reason: "Not allowed",
        })
      ).error,
    ).not.toBeNull();
  }
  expect(
    localQuery(
      `select count(*) from public.attendance where registration_id=${JSON.stringify(registrationA.registrationId)}`,
    ),
  ).toBe("1");
  expect(
    localQuery(
      `select count(*) from public.registrations where event_id=${JSON.stringify(eventB.id)} and participant_id=(select id from public.participants where normalized_phone='+15185550999')`,
    ),
  ).toBe("0");
});

test("cancelled events reject attendance, walk-ins, finalization, correction, and reopening without creating history", async () => {
  const event = createEvent(fixture, { status: "CANCELLED", state: "NOT_STARTED" });
  const registration = createRegisteredParticipant(fixture, event.id);
  const host = await signedInClient(fixture.hostA);
  const system = await signedInClient(fixture.system);
  for (const result of [
    await host.rpc("phase5_open_attendance", { p_event_id: event.id }),
    await host.rpc("phase5_mark_attendance", {
      p_registration_id: registration.registrationId,
      p_status: "ATTENDED",
      p_reason: null,
    }),
    await host.rpc(
      "phase5_create_walk_in",
      walkInArgs(fixture, event.id, "Cancelled", fixture.suffix, "+15185550777"),
    ),
    await host.rpc("phase5_finalize_attendance", { p_event_id: event.id }),
    await system.rpc("phase5_reopen_attendance", {
      p_event_id: event.id,
      p_reason: "Cannot restore",
    }),
  ])
    expect(result.error).not.toBeNull();
  expect(
    localQuery(
      `select count(*) from public.attendance where registration_id=${JSON.stringify(registration.registrationId)}`,
    ),
  ).toBe("0");
  expect(
    localQuery(
      `select registration_status, registration_outcome from public.registrations where id=${JSON.stringify(registration.registrationId)}`,
    ),
  ).toBe("REGISTERED|ACTIVE");
});
