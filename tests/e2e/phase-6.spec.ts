import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  createEvent,
  createPhase5Fixture,
  createRegisteredParticipant,
  localQuery,
  localSql,
  signInPage,
  signedInClient,
  type Phase5Fixture,
} from "./phase-5-fixtures";

test.describe.configure({ mode: "serial" });

let fixture: Phase5Fixture;
let attendedParticipant: ReturnType<typeof createRegisteredParticipant>;
let noShowParticipant: ReturnType<typeof createRegisteredParticipant>;
let attendedTaskId: string;
let noShowTaskId: string;

function sql(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function signInSystem(page: Page, next = "/admin") {
  await signInPage(page, fixture.system, next);
  await expect(page).toHaveURL(new RegExp(next.replace("?", "\\?")));
}

test.beforeAll(async () => {
  fixture = await createPhase5Fixture();
  const attendedEvent = createEvent(fixture, { status: "COMPLETED", state: "FINALIZED" });
  const noShowEvent = createEvent(fixture, { status: "COMPLETED", state: "FINALIZED" });
  attendedParticipant = createRegisteredParticipant(fixture, attendedEvent.id, {
    firstName: "CRM Attended",
    lastName: fixture.suffix,
    email: `crm-attended-${fixture.suffix}@example.test`,
  });
  noShowParticipant = createRegisteredParticipant(fixture, noShowEvent.id, {
    firstName: "CRM No Show",
    lastName: fixture.suffix,
  });
  localSql(`
    insert into public.attendance (registration_id, status, finalized_at, updated_by_admin_id)
    values
      (${sql(attendedParticipant.registrationId)}, 'ATTENDED', now(), ${sql(fixture.system.id)}),
      (${sql(noShowParticipant.registrationId)}, 'NO_SHOW', now(), ${sql(fixture.system.id)});
  `);
  attendedTaskId = localQuery(
    `select id from public.follow_up_tasks where trigger_key=${sql(`first-attendance:${attendedParticipant.participantId}`)}`,
  );
  noShowTaskId = localQuery(
    `select id from public.follow_up_tasks where trigger_key=${sql(`no-show:${noShowParticipant.registrationId}`)}`,
  );
  expect(attendedTaskId).toMatch(/^[0-9a-f-]{36}$/);
  expect(noShowTaskId).toMatch(/^[0-9a-f-]{36}$/);
});

test("System Admin can search and inspect participant CRM history", async ({ page }) => {
  await signInSystem(page, "/admin/participants");
  await page.getByPlaceholder("Name, phone, or email").fill("CRM Attended");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(
    page.getByRole("link", { name: new RegExp(`CRM Attended ${fixture.suffix}`) }),
  ).toBeVisible();
  await page.getByRole("link", { name: new RegExp(`CRM Attended ${fixture.suffix}`) }).click();
  await expect(page).toHaveURL(/\/admin\/participants\//);
  await expect(page.getByRole("heading", { name: "CRM Attended" })).toBeVisible();
  await expect(page.getByText("Registration and attendance history")).toBeVisible();
  await expect(page.getByText("Attendance ATTENDED")).toBeVisible();
  await expect(page.getByText("Follow-up history")).toBeVisible();
});

test("Host Admin is denied global participant CRM and follow-up routes", async ({ page }) => {
  await signInPage(page, fixture.hostA, "/admin/participants");
  await expect(page).toHaveURL(/\/admin\/access-denied/);
  await signInPage(page, fixture.hostA, "/admin/follow-ups");
  await expect(page).toHaveURL(/\/admin\/access-denied/);
});

test("group chat reminders are readable only by an active System Admin", async () => {
  const reminderId = randomUUID();
  localSql(`
    insert into public.group_chat_reminders (
      id, organization_id, event_id, reminder_type, trigger_key, due_at, suggested_message
    ) values (
      ${sql(reminderId)}, ${sql(fixture.organizationA)}, null, 'WEEKLY_TIP',
      ${sql(`community-001:${fixture.suffix}`)}, now(), 'Synthetic reminder for RLS coverage.'
    );
  `);

  const host = await signedInClient(fixture.hostA);
  const hostResult = await host.from("group_chat_reminders").select("id").eq("id", reminderId);
  expect(hostResult.error).toBeNull();
  expect(hostResult.data).toEqual([]);

  const system = await signedInClient(fixture.system);
  const systemResult = await system.from("group_chat_reminders").select("id").eq("id", reminderId);
  expect(systemResult.error).toBeNull();
  expect(systemResult.data).toEqual([{ id: reminderId }]);
});

test("copy evidence and completion preserve the task lifecycle", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: process.env.NEXT_PUBLIC_APP_URL!,
  });
  await signInSystem(page, "/admin/follow-ups");
  const task = page.locator("article").filter({ hasText: `CRM Attended ${fixture.suffix}` });
  await expect(task).toBeVisible();
  await task.getByRole("button", { name: "Copy message" }).click();
  await expect(task.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(
    localQuery(`select status from public.follow_up_tasks where id=${sql(attendedTaskId)}`),
  ).toBe("PENDING");
  expect(
    localQuery(
      `select copied_by_admin_id from public.follow_up_tasks where id=${sql(attendedTaskId)}`,
    ),
  ).toBe(fixture.system.id);
  await task.getByRole("button", { name: "Complete" }).click();
  await expect
    .poll(() =>
      localQuery(`select status from public.follow_up_tasks where id=${sql(attendedTaskId)}`),
    )
    .toBe("COMPLETED");
  expect(
    localQuery(
      `select completed_by_admin_id from public.follow_up_tasks where id=${sql(attendedTaskId)}`,
    ),
  ).toBe(fixture.system.id);
  await page.goto("/admin/follow-ups?status=COMPLETED");
  await page.getByText(/^Completed ·/).click();
  await expect(
    page.locator("article").filter({ hasText: `CRM Attended ${fixture.suffix}` }),
  ).toBeVisible();
});

test("dismissal requires a reason and direct task mutation is System Admin-only", async ({
  page,
}) => {
  await signInSystem(page, "/admin/follow-ups");
  const task = page.locator("article:visible").filter({ hasText: `CRM No Show ${fixture.suffix}` });
  await expect(task).toBeVisible();
  await task.getByRole("button", { name: "Dismiss" }).click();
  expect(
    localQuery(`select status from public.follow_up_tasks where id=${sql(noShowTaskId)}`),
  ).toBe("PENDING");
  await task
    .getByPlaceholder("Dismissal reason")
    .fill("Participant requested no further follow-up");
  await task.getByRole("button", { name: "Dismiss" }).click();
  await expect
    .poll(() =>
      localQuery(`select status from public.follow_up_tasks where id=${sql(noShowTaskId)}`),
    )
    .toBe("DISMISSED");
  await page.goto("/admin/follow-ups?status=DISMISSED");
  await page.getByText(/^Completed ·/).click();
  await expect(
    page.locator("article").filter({ hasText: `CRM No Show ${fixture.suffix}` }),
  ).toBeVisible();

  const host = await signedInClient(fixture.hostA);
  const result = await host.rpc("phase6_complete_follow_up_task", {
    p_task_id: attendedTaskId,
    p_outcome: "CONTACTED",
    p_notes: null,
  } as never);
  expect(result.data).toBeNull();
  expect(result.error?.message).toMatch(/task unavailable|permission|authorized/i);
});

test("System Admin can correct contact details without changing the participant history", async ({
  page,
}) => {
  await signInSystem(page, `/admin/participants/${noShowParticipant.participantId}`);
  const form = page.getByTestId("participant-contact-form");
  await expect(form).toBeVisible();
  await form.getByLabel("First name").fill("  CRM   Updated ");
  await form.getByLabel("Last name").fill("  Contact ");
  await form.getByLabel("Phone", { exact: true }).fill("+1 (518) 555-0199");
  await form.getByLabel("Phone country").fill("us");
  await form.getByLabel("Email").fill("  CRM.UPDATED@EXAMPLE.TEST ");
  await form
    .getByLabel("Reason for correction")
    .fill("Participant confirmed updated contact details");
  await form.getByRole("button", { name: "Save contact correction" }).click();
  await expect(form.getByRole("status")).toHaveText("Participant contact details updated.");
  await expect(page.getByRole("heading", { name: "CRM Updated Contact" })).toBeVisible();
  expect(
    localQuery(
      `select normalized_email from public.participants where id=${sql(noShowParticipant.participantId)}`,
    ),
  ).toBe("crm.updated@example.test");
  expect(
    localQuery(
      `select count(*) from public.follow_up_tasks where participant_id=${sql(noShowParticipant.participantId)}`,
    ),
  ).toBe("1");
  expect(
    localQuery(
      `select count(*) from public.registrations where participant_id=${sql(noShowParticipant.participantId)}`,
    ),
  ).toBe("1");
});
