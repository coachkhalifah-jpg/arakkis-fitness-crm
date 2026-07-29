import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Fixture = {
  supabase: SupabaseClient;
  organizationName: string;
  hostEmail: string;
  hostPassword: string;
  invitationEmail: string;
  invitationToken: string;
  expiredToken: string;
  revokedToken: string;
  consumedToken: string;
  nonAdminEmail: string;
  nonAdminPassword: string;
  inactiveEmail: string;
  inactivePassword: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} for local browser tests`);
  return value;
}

function tokenHash(token: string) {
  return `\\x${createHash("sha256").update(token, "utf8").digest("hex")}`;
}

function runtimePassword() {
  return `${randomBytes(24).toString("base64url")}Aa1!`;
}

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function runLocalSql(sql: string) {
  try {
    const container = execFileSync(
      "docker",
      ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
      { encoding: "utf8" },
    ).trim();
    if (!container) throw new Error("Local Supabase database container is not running");
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        container,
        "psql",
        "-v",
        "ON_ERROR_STOP=1",
        "-q",
        "-U",
        "postgres",
        "-d",
        "postgres",
      ],
      {
        input: `begin;\n${sql}\ncommit;\n`,
        stdio: ["pipe", "ignore", "pipe"],
      },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Local SQL fixture setup failed: ${detail.slice(0, 240)}`);
  }
}

async function createAuthUser(supabase: SupabaseClient, email: string, password: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error("Local Auth fixture setup failed");
  return data.user.id;
}

async function createInvitation(
  email: string,
  inviterId: string,
  organizationId: string,
  status: "PENDING" | "REVOKED" | "ACCEPTED",
  expiresAt: string,
) {
  const token = randomBytes(32).toString("base64url");
  const invitationId = randomUUID();
  runLocalSql(`
    insert into public.admin_invitations
      (id, invited_email, role, status, token_hash, token_expires_at, invited_by_admin_id, accepted_at, revoked_at)
    values (
      ${sqlString(invitationId)}, ${sqlString(email)}, 'HOST_ADMIN', ${sqlString(status)},
      decode(${sqlString(tokenHash(token).slice(2))}, 'hex'), ${sqlString(expiresAt)}, ${sqlString(inviterId)},
      ${status === "ACCEPTED" ? "now()" : "null"}, ${status === "REVOKED" ? "now()" : "null"}
    );
    insert into public.admin_invitation_organizations (invitation_id, organization_id)
    values (${sqlString(invitationId)}, ${sqlString(organizationId)});
  `);
  return token;
}

async function createFixture(): Promise<Fixture> {
  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  const suffix = randomUUID().slice(0, 8);
  const hostEmail = `browser-host-${suffix}@example.test`;
  const hostPassword = runtimePassword();
  const nonAdminEmail = `browser-user-${suffix}@example.test`;
  const nonAdminPassword = runtimePassword();
  const inactiveEmail = `browser-inactive-${suffix}@example.test`;
  const inactivePassword = runtimePassword();
  const inviterEmail = `browser-inviter-${suffix}@example.test`;
  const inviterPassword = runtimePassword();
  const organizationId = randomUUID();
  const organizationName = `Browser Organization ${suffix}`;
  const inviterId = await createAuthUser(supabase, inviterEmail, inviterPassword);
  const hostId = await createAuthUser(supabase, hostEmail, hostPassword);
  const nonAdminId = await createAuthUser(supabase, nonAdminEmail, nonAdminPassword);
  const inactiveId = await createAuthUser(supabase, inactiveEmail, inactivePassword);

  runLocalSql(`
    insert into public.organizations (id, name)
    values (${sqlString(organizationId)}, ${sqlString(organizationName)});
    insert into public.admin_profiles (id, display_name, email, role, status)
    values
      (${sqlString(inviterId)}, 'Browser System Admin', ${sqlString(inviterEmail)}, 'SYSTEM_ADMIN', 'ACTIVE'),
      (${sqlString(hostId)}, 'Browser Host Admin', ${sqlString(hostEmail)}, 'HOST_ADMIN', 'ACTIVE'),
      (${sqlString(inactiveId)}, 'Browser Inactive Admin', ${sqlString(inactiveEmail)}, 'HOST_ADMIN', 'SUSPENDED');
    insert into public.admin_organization_assignments (admin_profile_id, organization_id, created_by_admin_id)
    values (${sqlString(hostId)}, ${sqlString(organizationId)}, ${sqlString(inviterId)});
  `);

  const invitationEmail = `browser-invite-${suffix}@example.test`;
  const invitationToken = await createInvitation(
    invitationEmail,
    inviterId,
    organizationId,
    "PENDING",
    new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  );
  const expiredToken = await createInvitation(
    `browser-expired-${suffix}@example.test`,
    inviterId,
    organizationId,
    "PENDING",
    new Date(Date.now() - 60_000).toISOString(),
  );
  const revokedToken = await createInvitation(
    `browser-revoked-${suffix}@example.test`,
    inviterId,
    organizationId,
    "REVOKED",
    new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  );
  const consumedToken = await createInvitation(
    `browser-consumed-${suffix}@example.test`,
    inviterId,
    organizationId,
    "ACCEPTED",
    new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  );

  return {
    supabase,
    organizationName,
    hostEmail,
    hostPassword,
    invitationEmail,
    invitationToken,
    expiredToken,
    revokedToken,
    consumedToken,
    nonAdminEmail,
    nonAdminPassword,
    inactiveEmail,
    inactivePassword,
  };
}

async function signIn(page: Page, email: string, password: string, next = "/admin") {
  await page.goto(`/admin/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

let fixture: Fixture;
test.beforeAll(async () => {
  fixture = await createFixture();
});

test.afterAll(async () => {
  if (fixture) await fixture.supabase.auth.signOut();
});

test("accepts a valid invitation, persists the session, and rejects replay", async ({ page }) => {
  const rawToken = fixture.invitationToken;
  await page.goto(`/admin/invitations/accept?token=${encodeURIComponent(rawToken)}`);
  await page.getByLabel("Name").fill("Invited Browser Host");
  await page.getByLabel("Invited email").fill(fixture.invitationEmail);
  await page.getByLabel("Create password").fill(runtimePassword());
  const password = await page.getByLabel("Create password").inputValue();
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  await expect(page.getByText("HOST_ADMIN")).toBeVisible();
  await expect(page.getByText(fixture.organizationName)).toBeVisible();
  await expect(
    page.evaluate(
      (token) => JSON.stringify({ local: localStorage, session: sessionStorage }).includes(token),
      rawToken,
    ),
  ).resolves.toBe(false);
  await page.reload();
  await expect(page.getByText("HOST_ADMIN")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/sign-in/);

  await page.goto(`/admin/invitations/accept?token=${encodeURIComponent(rawToken)}`);
  await page.getByLabel("Name").fill("Replay Attempt");
  await page.getByLabel("Invited email").fill(fixture.invitationEmail);
  await page.getByLabel("Create password").fill(password);
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText(
    "This invitation is invalid or no longer available.",
  );
});

test("signs in an existing Host Admin and removes access on sign-out", async ({ page }) => {
  await signIn(page, fixture.hostEmail, fixture.hostPassword);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("HOST_ADMIN")).toBeVisible();
  await expect(page.getByText(fixture.organizationName)).toBeVisible();
  await page.reload();
  await expect(page.getByText(fixture.hostEmail)).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/sign-in/);
});

test("rejects non-admin and inactive admin access without protected content", async ({ page }) => {
  await signIn(page, fixture.nonAdminEmail, fixture.nonAdminPassword);
  await expect(page).toHaveURL(/\/admin\/access-denied/);
  await expect(page.getByText(/does not have active administrator access/i)).toBeVisible();

  await signIn(page, fixture.inactiveEmail, fixture.inactivePassword);
  await expect(page).toHaveURL(/\/admin\/access-denied/);
});

test("rejects malformed, expired, revoked, and consumed invitations", async ({ page }) => {
  await page.goto("/admin/invitations/accept?token=malformed");
  await expect(page.locator('p[role="alert"]')).toHaveText(
    "This invitation is invalid or no longer available.",
  );
  for (const token of [fixture.expiredToken, fixture.revokedToken, fixture.consumedToken]) {
    await page.goto(`/admin/invitations/accept?token=${encodeURIComponent(token)}`);
    await page.getByLabel("Name").fill("Invalid Attempt");
    await page.getByLabel("Invited email").fill("invalid@example.test");
    await page.getByLabel("Create password").fill(runtimePassword());
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText(
      "This invitation is invalid or no longer available.",
    );
  }
});

test("rejects incorrect credentials and unsafe redirect targets", async ({ page }) => {
  await page.goto("/admin/sign-in?next=https%3A%2F%2Fevil.example");
  await page.getByLabel("Email").fill(fixture.hostEmail);
  await page.getByLabel("Password").fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText(
    "Sign-in failed. Check your email and password and try again.",
  );

  await signIn(page, fixture.hostEmail, fixture.hostPassword, "https://evil.example");
  await expect(page).toHaveURL(/\/admin$/);
});
