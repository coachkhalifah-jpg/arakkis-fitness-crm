import { expect, test } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
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
let participant: ReturnType<typeof createRegisteredParticipant>;

function sql(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

test.beforeAll(async () => {
  fixture = await createPhase5Fixture();
  const event = createEvent(fixture, {
    name: `Manage Recovery Event ${fixture.suffix}`,
  });
  participant = createRegisteredParticipant(fixture, event.id, {
    firstName: "Manage Recovery",
    lastName: fixture.suffix,
    email: `manage-recovery-${fixture.suffix}@example.test`,
  });
});

test("System Admin can generate a one-time manage recovery link from participant CRM", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: process.env.NEXT_PUBLIC_APP_URL!,
  });
  await signInPage(page, fixture.system, `/admin/participants/${participant.participantId}`);
  await expect(page.getByTestId("participant-manage-recovery")).toBeVisible();
  await expect(page.getByTestId("manage-recovery-phone")).toContainText(/\d/);
  await page.getByTestId("manage-recovery-generate").click();
  await expect(page.getByTestId("manage-recovery-result")).toBeVisible();
  await expect(page.getByTestId("manage-recovery-result")).toContainText(
    "No message is sent automatically",
  );
  const url = await page.getByLabel("New manage recovery link").inputValue();
  expect(url).toMatch(/\/manage-bookings\/recover\?token=/);
  expect(
    localQuery(
      `select status from public.participant_manage_recovery_links where participant_id=${sql(participant.participantId)} and status='PENDING'`,
    ),
  ).toBe("PENDING");
  const audit = localQuery(
    `select new_values::text from public.audit_events where action='PARTICIPANT_MANAGE_RECOVERY_ISSUED' and new_values->>'participant_id'=${sql(participant.participantId)} order by created_at desc limit 1`,
  );
  expect(audit).toContain(participant.participantId);
  expect(audit.toLowerCase()).not.toContain("token=");
});

test("Host Admin cannot issue recovery links via RPC or CRM route", async ({ page }) => {
  await signInPage(page, fixture.hostA, `/admin/participants/${participant.participantId}`);
  await expect(page).toHaveURL(/\/admin\/access-denied/);

  const host = await signedInClient(fixture.hostA);
  const token = randomBytes(32).toString("base64url");
  const result = await host.rpc("issue_participant_manage_recovery_link", {
    p_participant_id: participant.participantId,
    p_token_hash: `\\x${hashToken(token)}`,
    p_token_expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    p_actor_admin_id: fixture.hostA.id,
  } as never);
  expect(result.error).not.toBeNull();
});

test("valid recovery link sets remember-device and lands on manage home", async ({ browser }) => {
  const token = randomBytes(32).toString("base64url");
  localSql(`
    select public.issue_participant_manage_recovery_link(
      ${sql(participant.participantId)}::uuid,
      decode(${sql(hashToken(token))}, 'hex'),
      now() + interval '72 hours',
      ${sql(fixture.system.id)}::uuid
    );
  `);

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/manage-bookings/recover?token=${encodeURIComponent(token)}`);
  await expect(page).toHaveURL(/\/$/);
  const cookies = await context.cookies();
  expect(cookies.some((cookie) => cookie.name === "fitness_remembered_device")).toBe(true);
  await expect(page.getByText(/Manage Recovery/i).first()).toBeVisible({ timeout: 15000 });
  expect(
    localQuery(
      `select status from public.participant_manage_recovery_links where participant_id=${sql(participant.participantId)} and status='CONSUMED' order by consumed_at desc limit 1`,
    ),
  ).toBe("CONSUMED");

  // Single-use: reopen fails calmly
  await page.goto(`/manage-bookings/recover?token=${encodeURIComponent(token)}`);
  await expect(page.getByRole("heading", { name: /recovery link isn’t available/i })).toBeVisible();
  await context.close();
});

test("expired revoked and malformed recovery links stay on calm recovery", async ({ page }) => {
  const revokedToken = randomBytes(32).toString("base64url");
  const expiredToken = randomBytes(32).toString("base64url");
  localSql(`
    select public.issue_participant_manage_recovery_link(
      ${sql(participant.participantId)}::uuid,
      decode(${sql(hashToken(revokedToken))}, 'hex'),
      now() + interval '72 hours',
      ${sql(fixture.system.id)}::uuid
    );
    select public.revoke_participant_manage_recovery_link(
      ${sql(participant.participantId)}::uuid,
      ${sql(fixture.system.id)}::uuid
    );
    insert into public.participant_manage_recovery_links (
      participant_id, token_hash, status, issued_by_admin_id, issued_at, expires_at
    ) values (
      ${sql(participant.participantId)},
      decode(${sql(hashToken(expiredToken))}, 'hex'),
      'PENDING',
      ${sql(fixture.system.id)},
      now() - interval '2 hours',
      now() - interval '1 hour'
    );
  `);

  for (const token of [revokedToken, expiredToken, "not-a-valid-token", ""]) {
    await page.goto(
      token
        ? `/manage-bookings/recover?token=${encodeURIComponent(token)}`
        : "/manage-bookings/recover",
    );
    await expect(
      page.getByRole("heading", { name: /recovery link isn’t available/i }),
    ).toBeVisible();
    await expect(page.getByText(/Browse events/i)).toBeVisible();
  }
});
