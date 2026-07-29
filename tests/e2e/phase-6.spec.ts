import { expect, test, type Page } from "@playwright/test";
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

test("copy evidence and completion preserve the task lifecycle", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:3000",
  });
  await signInSystem(page, "/admin/follow-ups");
  const task = page.locator("article").filter({ hasText: `CRM Attended ${fixture.suffix}` });
  await expect(task).toBeVisible();
  await task.getByRole("button", { name: "Copy" }).click();
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
  await expect(
    page.locator("article").filter({ hasText: `CRM Attended ${fixture.suffix}` }),
  ).toBeVisible();
});

test("dismissal requires a reason and direct task mutation is System Admin-only", async ({
  page,
}) => {
  await signInSystem(page, "/admin/follow-ups");
  const task = page.locator("article").filter({ hasText: `CRM No Show ${fixture.suffix}` });
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
