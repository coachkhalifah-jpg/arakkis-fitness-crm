import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { expect, test, type Browser } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import jsQR from "jsqr";
import { PNG } from "pngjs";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function sql(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function localSql(statement: string) {
  const container = execFileSync(
    "docker",
    ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
    { encoding: "utf8" },
  ).trim();
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
    { input: `begin;\n${statement};\ncommit;\n` },
  );
}

function localSqlQuery(statement: string) {
  const container = execFileSync(
    "docker",
    ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
    { encoding: "utf8" },
  ).trim();
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { input: statement, encoding: "utf8" },
  ).trim();
}

function serviceClient() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function systemFixture(capacity = 20) {
  const service = serviceClient();
  const suffix = randomUUID().slice(0, 8);
  const password = `${randomBytes(24).toString("base64url")}Aa1!`;
  const email = `phase7-browser-${suffix}@example.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error("Could not create Phase 7 browser admin");
  const organizationId = randomUUID();
  const venueId = randomUUID();
  const eventId = randomUUID();
  const draftId = randomUUID();
  const participationId = randomUUID();
  const dataUseId = randomUUID();
  const slug = `phase-seven-${suffix}`;
  const version = 9700 + (Number.parseInt(suffix, 16) % 100000);
  localSql(`
    insert into public.admin_profiles (id, display_name, email, role, status) values (${sql(data.user.id)}, 'Phase 7 Browser Admin', ${sql(email)}, 'SYSTEM_ADMIN', 'ACTIVE');
    insert into public.organizations (id, name) values (${sql(organizationId)}, ${sql(`Phase 7 Browser Organization ${suffix}`)});
    insert into public.venues (id, organization_id, name, street, city, state, postal_code, timezone) values (${sql(venueId)}, ${sql(organizationId)}, 'Phase 7 Browser Venue', '1 Test Street', 'Albany', 'NY', '12207', 'America/New_York');
    insert into public.events (id, host_organization_id, venue_id, name, description, participant_instructions, starts_at, ends_at, timezone, capacity, registration_deadline, status, visibility, publication_status, public_slug, created_by_admin_id)
    values (${sql(eventId)}, ${sql(organizationId)}, ${sql(venueId)}, 'Phase 7 Browser Event', 'Synthetic event.', 'Bring water.', '2099-06-15T14:00:00Z', '2099-06-15T15:00:00Z', 'America/New_York', ${capacity}, '2099-06-15T13:00:00Z', 'OPEN', 'PUBLIC', 'PUBLISHED', ${sql(slug)}, ${sql(data.user.id)});
    insert into public.events (id, host_organization_id, venue_id, name, description, participant_instructions, starts_at, ends_at, timezone, capacity, registration_deadline, status, visibility, publication_status, public_slug, created_by_admin_id)
    values (${sql(draftId)}, ${sql(organizationId)}, ${sql(venueId)}, 'Phase 7 Draft Event', 'Synthetic draft.', 'Bring water.', '2099-06-16T14:00:00Z', '2099-06-16T15:00:00Z', 'America/New_York', 20, '2099-06-16T13:00:00Z', 'DRAFT', 'PUBLIC', 'DRAFT', ${sql(`phase-seven-draft-${suffix}`)}, ${sql(data.user.id)});
    insert into public.acknowledgment_versions (id, type, version, exact_text, content_hash, effective_at, legal_status, created_by_admin_id) values
      (${sql(participationId)}, 'PARTICIPATION_RISK', ${version}, 'Synthetic participation acknowledgment.', decode(repeat('aa', 32), 'hex'), now(), 'PROVISIONAL', ${sql(data.user.id)}),
      (${sql(dataUseId)}, 'DATA_USE', ${version}, 'Synthetic data-use acknowledgment.', decode(repeat('bb', 32), 'hex'), now(), 'APPROVED', ${sql(data.user.id)});
  `);
  return { email, password, organizationId, eventId, draftId, slug };
}

async function invitationFixture(
  fixture: Awaited<ReturnType<typeof systemFixture>>,
  email: string,
  expiresAt: string,
) {
  const token = randomBytes(32).toString("base64url");
  const invitationId = randomUUID();
  const hash = createHash("sha256").update(token).digest("hex");
  localSql(`
    insert into public.admin_invitations (id, invited_email, role, status, token_hash, token_expires_at, invited_by_admin_id)
    values (${sql(invitationId)}, ${sql(email)}, 'HOST_ADMIN', 'PENDING', decode(${sql(hash)}, 'hex'), ${sql(expiresAt)}, (select id from public.admin_profiles where email = ${sql(fixture.email)}));
    insert into public.admin_invitation_organizations (invitation_id, organization_id)
    values (${sql(invitationId)}, ${sql(fixture.organizationId)});
  `);
  return { token, invitationId };
}

async function createAdminIdentity(
  fixture: Awaited<ReturnType<typeof systemFixture>>,
  role: "HOST_ADMIN" | null,
  status: "ACTIVE" | "SUSPENDED",
  organizationId = fixture.organizationId,
) {
  const service = serviceClient();
  const suffix = randomUUID().slice(0, 8);
  const email = `phase7-${(role ?? "participant").toLowerCase()}-${suffix}@example.test`;
  const password = `${randomBytes(24).toString("base64url")}Aa1!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error("Could not create Phase 7 authorization identity");
  if (role) {
    localSql(`
      insert into public.admin_profiles (id, display_name, email, role, status)
      values (${sql(data.user.id)}, ${sql(`Phase 7 ${role} ${suffix}`)}, ${sql(email)}, ${sql(role)}, ${sql(status)});
      ${role === "HOST_ADMIN" ? `insert into public.admin_organization_assignments (admin_profile_id, organization_id, created_by_admin_id) values (${sql(data.user.id)}, ${sql(organizationId)}, (select id from public.admin_profiles where email = ${sql(fixture.email)}));` : ""}
    `);
  }
  return { email, password };
}

async function signedInPage(browser: Browser, email: string, password: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(?:\/access-denied)?$/);
  return { context, page };
}

test.describe("Phase 7 publishing and slug registration", () => {
  test("resolves a public slug and submits without exposing a private event id", async ({
    page,
  }) => {
    const fixture = await systemFixture();
    await page.goto(`/register/${fixture.slug}`);
    await expect(page.getByLabel("Mobile phone")).toHaveAttribute("type", "tel");
    await expect(page.getByLabel("Mobile phone")).toHaveAttribute("placeholder", "+1 518-867-5309");
    await expect(page.getByRole("heading", { name: "Phase 7 Browser Event" })).toBeVisible();
    await expect(page.locator('input[name="eventIds"]')).toHaveCount(0);
    expect(await page.content()).not.toContain(fixture.eventId);
    await page.getByLabel("First name").fill("Slug");
    await page.getByLabel("Last name").fill("Participant");
    await page.getByLabel("Mobile phone").fill("+15185550123");
    await page.locator('input[type="checkbox"]').nth(0).check();
    await page.locator('input[type="checkbox"]').nth(1).check();
    await page.locator('input[type="checkbox"]').nth(2).check();
    await page.getByRole("button", { name: "Book Class" }).click();
    await expect(page).toHaveURL(/\/registration\/confirmation\?token=/);
    await expect(page.getByText("Phase 7 Browser Event")).toBeVisible();
  });

  test("preserves participant input and focuses the invalid field after validation failure", async ({
    page,
  }) => {
    const fixture = await systemFixture();
    await page.goto(`/register/${fixture.slug}`);
    await page.getByLabel("First name").fill("Test");
    await page.getByLabel("Last name").fill("Booker");
    await page.getByLabel("Mobile phone").fill("123");
    await page.getByLabel("Email (optional)").fill("test.booker@example.test");
    await page.locator('input[type="checkbox"]').nth(0).check();
    await page.getByLabel("Synthetic participation acknowledgment.").check();
    await page.getByLabel("Synthetic data-use acknowledgment.").check();
    await page.getByRole("button", { name: "Book Class" }).click();

    await expect(page).toHaveURL(new RegExp(`/register/${fixture.slug}$`));
    await expect(page.locator("#phone-error")).toHaveText(
      "Enter a valid phone number for the selected country.",
    );
    await expect(page.getByLabel("First name")).toHaveValue("Test");
    await expect(page.getByLabel("Last name")).toHaveValue("Booker");
    await expect(page.getByLabel("Mobile phone")).toHaveValue("123");
    await expect(page.getByLabel("Email (optional)")).toHaveValue("test.booker@example.test");
    await expect(page.locator('input[type="checkbox"]').nth(0)).toBeChecked();
    await expect(page.getByLabel("Mobile phone")).toBeFocused();
    expect(
      localSqlQuery(
        `select count(*) from public.registrations where event_id=${sql(fixture.eventId)} and registration_status='REGISTERED'`,
      ),
    ).toBe("0");
  });

  test("publishes, shares, and registers a draft through the canonical slug", async ({ page }) => {
    const fixture = await systemFixture();
    await page.goto("/admin/sign-in");
    await page.getByLabel("Email").fill(fixture.email);
    await page.getByLabel("Password").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto(`/admin/events/${fixture.draftId}`);
    await expect(page.getByText("DRAFT", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("PUBLISHED", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Unpublish", exact: true }).click();
    await expect(page.getByText("UNPUBLISHED", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("PUBLISHED", { exact: true }).first()).toBeVisible();
    const canonical = await page.getByTestId("canonical-url").textContent();
    expect(canonical).toContain(`/register/phase-seven-draft-`);
    expect(canonical).not.toContain(fixture.draftId);
    await page.goto(canonical!);
    await expect(page.getByRole("heading", { name: "Phase 7 Draft Event" })).toBeVisible();
    await expect(page.getByText(/Phase 7 Browser Venue/).first()).toBeVisible();
    await page.getByLabel("First name").fill("Published");
    await page.getByLabel("Last name").fill("Participant");
    await page.getByLabel("Mobile phone").fill("+15185550124");
    await page.locator('input[type="checkbox"]').nth(0).check();
    await page.locator('input[type="checkbox"]').nth(1).check();
    await page.locator('input[type="checkbox"]').nth(2).check();
    await page.getByRole("button", { name: "Book Class" }).click();
    await expect(page).toHaveURL(/\/registration\/confirmation\?token=/);
    const stored = localSqlQuery(
      `select count(*) from public.registrations where event_id = '${fixture.draftId}' and registration_status = 'REGISTERED'`,
    );
    expect(stored).toBe("1");
  });

  test("rejects pause, unpublish, close, and capacity changes after page load", async ({
    page,
  }) => {
    const fixture = await systemFixture(1);
    await page.goto(`/register/${fixture.slug}`);
    await expect(page.getByRole("heading", { name: "Phase 7 Browser Event" })).toBeVisible();
    localSql(
      `update public.events set registration_paused_at = now() where id = '${fixture.eventId}'`,
    );
    await page.getByLabel("First name").fill("Paused");
    await page.getByLabel("Last name").fill("Participant");
    await page.getByLabel("Mobile phone").fill("+15185550125");
    await page.locator('input[type="checkbox"]').nth(0).check();
    await page.locator('input[type="checkbox"]').nth(1).check();
    await page.locator('input[type="checkbox"]').nth(2).check();
    await page.getByRole("button", { name: "Book Class" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText(
      /could not be completed|unavailable|no longer available/i,
    );
    expect(
      localSqlQuery(
        `select count(*) from public.registrations where event_id = '${fixture.eventId}'`,
      ),
    ).toBe("0");

    const states = [
      {
        sql: `update public.events set registration_paused_at = null, publication_status = 'UNPUBLISHED' where id = '${fixture.eventId}'`,
        text: "UNPUBLISHED",
      },
      {
        sql: `update public.events set publication_status = 'PUBLISHED', registration_closes_at = now() - interval '1 minute' where id = '${fixture.eventId}'`,
        text: "CLOSED",
      },
    ];
    for (const state of states) {
      localSql(state.sql);
      await page.goto(`/register/${fixture.slug}`);
      await expect(page.getByText(new RegExp(state.text.replace("_", " "), "i"))).toBeVisible();
    }
  });

  test("protects slug resolution from conflicting participant identifiers", async ({ page }) => {
    const fixture = await systemFixture();
    await page.goto(`/register/${fixture.slug}`);
    await page.locator('input[name="publicSlug"]').evaluate((input) => {
      const hidden = document.createElement("input");
      hidden.name = "eventIds";
      hidden.value = "00000000-0000-0000-0000-000000000000";
      (input as HTMLInputElement).form?.append(hidden);
    });
    await page.getByLabel("First name").fill("Tampered");
    await page.getByLabel("Last name").fill("Slug");
    await page.getByLabel("Mobile phone").fill("+15185550126");
    await page.locator('input[type="checkbox"]').nth(0).check();
    await page.locator('input[type="checkbox"]').nth(1).check();
    await page.locator('input[type="checkbox"]').nth(2).check();
    await page.getByRole("button", { name: "Book Class" }).click();
    await expect(page).toHaveURL(/\/registration\/confirmation\?token=/);
    expect(
      localSqlQuery(
        `select count(*) from public.registrations where event_id = '${fixture.eventId}'`,
      ),
    ).toBe("1");
    expect(
      localSqlQuery(
        "select count(*) from public.registrations where event_id = '00000000-0000-0000-0000-000000000000'",
      ),
    ).toBe("0");
  });

  test("rejects a final-capacity change after the page was loaded", async ({ page }) => {
    const fixture = await systemFixture(1);
    await page.goto(`/register/${fixture.slug}`);
    await expect(page.getByRole("heading", { name: "Phase 7 Browser Event" })).toBeVisible();
    localSql(`
      with participant as (
        insert into public.participants (first_name, last_name, normalized_first_name, normalized_last_name, display_phone, normalized_phone, phone_country)
        values ('Capacity', 'Holder', 'capacity', 'holder', '+15185550127', '+15185550127', 'US') returning id
      ), group_row as (
        insert into public.registration_groups (participant_id, submission_source, participation_acknowledgment_version_id, participation_acknowledged_at, data_use_acknowledgment_version_id, data_use_acknowledged_at, idempotency_key)
        select participant.id, 'PUBLIC', (select id from public.acknowledgment_versions where type = 'PARTICIPATION_RISK' order by version desc limit 1), now(), (select id from public.acknowledgment_versions where type = 'DATA_USE' order by version desc limit 1), now(), 'phase7-capacity-${fixture.eventId}' from participant returning id, participant_id
      )
      insert into public.registrations (registration_group_id, participant_id, event_id)
      select group_row.id, group_row.participant_id, '${fixture.eventId}' from group_row;
    `);
    expect(
      localSqlQuery(
        `select count(*) from public.registrations where event_id = '${fixture.eventId}'`,
      ),
    ).toBe("1");
    await page.getByLabel("First name").fill("Late");
    await page.getByLabel("Last name").fill("Participant");
    await page.getByLabel("Mobile phone").fill("+15185550128");
    await page.locator('input[type="checkbox"]').nth(0).check();
    await page.locator('input[type="checkbox"]').nth(1).check();
    await page.locator('input[type="checkbox"]').nth(2).check();
    await page.getByRole("button", { name: "Book Class" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText(/no longer available/i);
    expect(
      localSqlQuery(
        `select count(*) from public.registrations where event_id = '${fixture.eventId}'`,
      ),
    ).toBe("1");
  });

  test("decodes QR payload exactly and verifies privacy and current availability", async ({
    page,
  }) => {
    const fixture = await systemFixture();
    await page.goto("/admin/sign-in");
    await page.getByLabel("Email").fill(fixture.email);
    await page.getByLabel("Password").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    const response = await page.request.get(`/admin/events/${fixture.eventId}/qr`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    expect(response.headers()["content-disposition"]).toContain("registration-qr.png");
    const body = await response.body();
    expect(body.length).toBeGreaterThan(1000);
    expect(body.toString("utf8")).not.toContain(fixture.eventId);
    const image = PNG.sync.read(body);
    const decoded = jsQR(new Uint8ClampedArray(image.data), image.width, image.height, {
      inversionAttempts: "dontInvert",
    });
    const canonicalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/register/${fixture.slug}`;
    expect(decoded?.data).toBe(canonicalUrl);
    expect(decoded?.data).not.toMatch(new RegExp(`${fixture.eventId}|${fixture.organizationId}`));
    expect(decoded?.data).not.toMatch(/token|password|participant|analytics|utm_/i);
    await page.goto(decoded!.data);
    await expect(page.getByRole("heading", { name: "Phase 7 Browser Event" })).toBeVisible();
    await page.goto(`/register/${fixture.slug}`);
    await expect(page.getByRole("heading", { name: "Phase 7 Browser Event" })).toBeVisible();
    localSql(
      `update public.events set publication_status = 'UNPUBLISHED' where id = '${fixture.eventId}'`,
    );
    await page.goto(`/register/${fixture.slug}`);
    await expect(page.getByText(/UNPUBLISHED/i)).toBeVisible();
  });

  test("enforces QR authorization for assigned, cross-organization, inactive, non-admin, and anonymous users", async ({
    page,
  }) => {
    const fixture = await systemFixture();
    const browser = page.context().browser();
    if (!browser) throw new Error("Browser context unavailable");
    const assigned = await createAdminIdentity(fixture, "HOST_ADMIN", "ACTIVE");
    const inactive = await createAdminIdentity(fixture, "HOST_ADMIN", "SUSPENDED");
    const nonAdmin = await createAdminIdentity(fixture, null, "ACTIVE");
    const otherOrganizationId = randomUUID();
    localSql(
      `insert into public.organizations (id, name) values (${sql(otherOrganizationId)}, ${sql(`Phase 7 Other Organization ${otherOrganizationId}`)});`,
    );
    const crossOrganization = await createAdminIdentity(
      fixture,
      "HOST_ADMIN",
      "ACTIVE",
      otherOrganizationId,
    );

    const assignedSession = await signedInPage(browser, assigned.email, assigned.password);
    expect(
      (await assignedSession.page.request.get(`/admin/events/${fixture.eventId}/qr`)).status(),
    ).toBe(200);
    await assignedSession.page.goto(`/admin/events/${fixture.eventId}`);
    await expect(
      assignedSession.page.getByRole("heading", { name: "Publishing and registration link" }),
    ).toBeVisible();
    await expect(assignedSession.page.getByRole("button", { name: "Publish" })).toHaveCount(0);
    await assignedSession.context.close();

    const crossSession = await signedInPage(
      browser,
      crossOrganization.email,
      crossOrganization.password,
    );
    expect(
      (await crossSession.page.request.get(`/admin/events/${fixture.eventId}/qr`)).status(),
    ).toBe(404);
    await crossSession.page.goto(`/admin/events/${fixture.eventId}`);
    await expect(crossSession.page).toHaveURL(/\/admin\/access-denied$/);
    await crossSession.context.close();

    const inactiveSession = await signedInPage(browser, inactive.email, inactive.password);
    await inactiveSession.page.goto(`/admin/events/${fixture.eventId}/qr`);
    await expect(inactiveSession.page).toHaveURL(/\/admin\/access-denied$/);
    await inactiveSession.context.close();

    const nonAdminSession = await signedInPage(browser, nonAdmin.email, nonAdmin.password);
    await nonAdminSession.page.goto(`/admin/events/${fixture.eventId}/qr`);
    await expect(nonAdminSession.page).toHaveURL(/\/admin\/access-denied$/);
    await nonAdminSession.page.goto("/admin/invitations");
    await expect(nonAdminSession.page).toHaveURL(/\/admin\/access-denied$/);
    await nonAdminSession.context.close();

    const anonymous = await browser.newContext();
    const anonymousPage = await anonymous.newPage();
    await anonymousPage.goto(`/admin/events/${fixture.eventId}/qr`);
    await expect(anonymousPage).toHaveURL(/\/admin\/sign-in/);
    await anonymousPage.goto("/admin/invitations");
    await expect(anonymousPage).toHaveURL(/\/admin\/sign-in/);
    await anonymous.close();
  });

  test("returns a safe response for unknown and malformed slugs", async ({ page }) => {
    await page.goto("/register/not-a-real-event");
    await expect(page.getByText("This event is unavailable.")).toBeVisible();
    await page.goto("/register/ADMIN");
    await expect(page.getByText("This event is unavailable.")).toBeVisible();
  });

  test("accepts a matching existing account once and preserves one assignment", async ({
    page,
  }) => {
    const fixture = await systemFixture();
    const invitedEmail = `matching-${fixture.slug}@example.test`;
    const password = `${randomBytes(24).toString("base64url")}Aa1!`;
    await serviceClient().auth.admin.createUser({
      email: invitedEmail,
      password,
      email_confirm: true,
    });
    const invitation = await invitationFixture(fixture, invitedEmail, "2099-06-20T00:00:00Z");
    await page.goto("/admin/sign-in");
    await page.getByLabel("Email").fill(invitedEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/access-denied/);
    await page.goto(`/admin/invitations/accept?token=${encodeURIComponent(invitation.token)}`);
    await page.getByLabel("Name").fill("Matching Account");
    await page.getByLabel("Invited email").fill(invitedEmail);
    await page.getByLabel("Create password").fill(password);
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    expect(
      localSqlQuery(`select count(*) from public.admin_profiles where email = '${invitedEmail}'`),
    ).toBe("1");
    expect(
      localSqlQuery(
        `select count(*) from public.admin_organization_assignments where admin_profile_id = (select id from public.admin_profiles where email = '${invitedEmail}')`,
      ),
    ).toBe("1");
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.goto(`/admin/invitations/accept?token=${encodeURIComponent(invitation.token)}`);
    await page.getByLabel("Name").fill("Replay");
    await page.getByLabel("Invited email").fill(invitedEmail);
    await page.getByLabel("Create password").fill(password);
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText(
      "This invitation is invalid or no longer available.",
    );
  });

  test("denies a mismatched authenticated account without changing the invitation", async ({
    page,
  }) => {
    const fixture = await systemFixture();
    const invitedEmail = `intended-${fixture.slug}@example.test`;
    const mismatchEmail = `mismatch-${fixture.slug}@example.test`;
    const password = `${randomBytes(24).toString("base64url")}Aa1!`;
    const mismatchPassword = `${randomBytes(24).toString("base64url")}Aa1!`;
    await serviceClient().auth.admin.createUser({
      email: mismatchEmail,
      password: mismatchPassword,
      email_confirm: true,
    });
    const invitation = await invitationFixture(fixture, invitedEmail, "2099-06-20T00:00:00Z");
    await page.goto("/admin/sign-in");
    await page.getByLabel("Email").fill(mismatchEmail);
    await page.getByLabel("Password").fill(mismatchPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/access-denied/);
    await page.goto(`/admin/invitations/accept?token=${encodeURIComponent(invitation.token)}`);
    await page.getByLabel("Name").fill("Mismatch");
    await page.getByLabel("Invited email").fill(invitedEmail);
    await page.getByLabel("Create password").fill(password);
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText(
      "This invitation is invalid or no longer available.",
    );
    expect(
      localSqlQuery(
        `select status from public.admin_invitations where id = '${invitation.invitationId}'`,
      ),
    ).toBe("PENDING");
    expect(
      localSqlQuery(`select count(*) from public.admin_profiles where email = '${invitedEmail}'`),
    ).toBe("0");
  });

  test("revoked and expired invitation URLs fail safely", async ({ page }) => {
    const fixture = await systemFixture();
    const revokedEmail = `revoked-${fixture.slug}@example.test`;
    const expiredEmail = `expired-${fixture.slug}@example.test`;
    const revoked = await invitationFixture(fixture, revokedEmail, "2099-06-20T00:00:00Z");
    const expired = await invitationFixture(fixture, expiredEmail, "2000-01-01T00:00:00Z");
    localSql(
      `update public.admin_invitations set status = 'REVOKED', revoked_at = now() where id = '${revoked.invitationId}'`,
    );
    const context = await page.context().browser()!.newContext();
    const anonymous = await context.newPage();
    for (const item of [revoked, expired]) {
      const email = item === revoked ? revokedEmail : expiredEmail;
      await anonymous.goto(`/admin/invitations/accept?token=${encodeURIComponent(item.token)}`);
      await anonymous.getByLabel("Name").fill("Unavailable");
      await anonymous.getByLabel("Invited email").fill(email);
      await anonymous.getByLabel("Create password").fill("UnavailablePassword1!");
      await anonymous.getByRole("button", { name: "Accept invitation" }).click();
      await expect(anonymous.locator('p[role="alert"]')).toHaveText(
        "This invitation is invalid or no longer available.",
      );
    }
    await context.close();
  });

  test("regeneration invalidates the old URL and exposes the replacement once", async ({
    page,
  }) => {
    const fixture = await systemFixture();
    const email = `regenerated-${fixture.slug}@example.test`;
    const invitation = await invitationFixture(fixture, email, "2099-06-20T00:00:00Z");
    await page.goto("/admin/sign-in");
    await page.getByLabel("Email").fill(fixture.email);
    await page.getByLabel("Password").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/invitations");
    const row = page.locator("article").filter({ hasText: email });
    await row.getByRole("button", { name: "Regenerate" }).click();
    const replacement = await page
      .getByRole("textbox", { name: "New invitation link" })
      .inputValue();
    expect(replacement).toContain("/admin/invitations/accept?token=");
    expect(replacement).not.toContain(invitation.token);
    await page.reload();
    await expect(page.getByRole("textbox", { name: "New invitation link" })).toHaveCount(0);
    const context = await page.context().browser()!.newContext();
    const anonymous = await context.newPage();
    await anonymous.goto(`/admin/invitations/accept?token=${encodeURIComponent(invitation.token)}`);
    await anonymous.getByLabel("Name").fill("Old Token");
    await anonymous.getByLabel("Invited email").fill(email);
    await anonymous.getByLabel("Create password").fill("OldTokenPassword1!");
    await anonymous.getByRole("button", { name: "Accept invitation" }).click();
    await expect(anonymous.locator('p[role="alert"]')).toHaveText(
      "This invitation is invalid or no longer available.",
    );
    await anonymous.goto(replacement);
    await expect(anonymous.getByRole("heading", { name: "Accept invitation" })).toBeVisible();
    await context.close();
  });

  test("restricts invitation management to System Admin and denies scoped or inactive identities", async ({
    page,
  }) => {
    const fixture = await systemFixture();
    const browser = page.context().browser();
    if (!browser) throw new Error("Browser context unavailable");
    const assigned = await createAdminIdentity(fixture, "HOST_ADMIN", "ACTIVE");
    const inactive = await createAdminIdentity(fixture, "HOST_ADMIN", "SUSPENDED");
    const nonAdmin = await createAdminIdentity(fixture, null, "ACTIVE");
    const otherOrganizationId = randomUUID();
    localSql(
      `insert into public.organizations (id, name) values (${sql(otherOrganizationId)}, ${sql(`Phase 7 Invitation Other Organization ${otherOrganizationId}`)});`,
    );
    const crossOrganization = await createAdminIdentity(
      fixture,
      "HOST_ADMIN",
      "ACTIVE",
      otherOrganizationId,
    );

    await page.goto("/admin/sign-in");
    await page.getByLabel("Email").fill(fixture.email);
    await page.getByLabel("Password").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    expect((await page.request.get("/admin/invitations")).status()).toBe(200);
    for (const identity of [assigned, inactive, nonAdmin, crossOrganization]) {
      const session = await signedInPage(browser, identity.email, identity.password);
      await session.page.goto("/admin/invitations");
      await expect(session.page).toHaveURL(/\/admin\/access-denied$/);
      await session.context.close();
    }
    const anonymous = await browser.newContext();
    const anonymousPage = await anonymous.newPage();
    await anonymousPage.goto("/admin/invitations");
    await expect(anonymousPage).toHaveURL(/\/admin\/sign-in/);
    await anonymous.close();
  });

  test("keeps Phase 7 participant and administrator surfaces usable on a narrow mobile viewport", async ({
    page,
  }) => {
    const fixture = await systemFixture();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/register/${fixture.slug}`);
    await expect(page.getByRole("heading", { name: "Phase 7 Browser Event" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await expect(page.getByLabel("First name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Book Class" })).toBeVisible();

    await page.goto("/admin/sign-in");
    await page.locator('input[name="email"]:visible').fill(fixture.email);
    await page.locator('input[name="password"]:visible').fill(fixture.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto(`/admin/events/${fixture.eventId}`);
    await expect(
      page.getByRole("heading", { name: "Publishing and registration link" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy registration link" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download QR" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });

  test("supports keyboard-only participant registration and administrator sharing", async ({
    page,
  }) => {
    const fixture = await systemFixture();
    await page.goto(`/register/${fixture.slug}`);
    await page.getByLabel("First name").fill("Keyboard");
    await page.getByLabel("Last name").fill("Participant");
    await page.getByLabel("Mobile phone").fill("+15185550129");
    for (const checkbox of [
      page.locator('input[name="publicSlug"]'),
      page.locator('input[name="participationAcknowledged"]'),
      page.locator('input[name="dataUseAcknowledged"]'),
    ]) {
      await checkbox.check();
    }
    for (const checkbox of [
      page.locator('input[name="publicSlug"]'),
      page.locator('input[name="participationAcknowledged"]'),
      page.locator('input[name="dataUseAcknowledged"]'),
    ]) {
      await expect(checkbox).toBeChecked();
    }
    await page.getByRole("button", { name: "Book Class" }).click();
    await expect(page).toHaveURL(/\/registration\/confirmation\?token=/);

    await page.goto("/admin/sign-in");
    await page.getByLabel("Email").fill(fixture.email);
    await page.getByLabel("Password").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto(`/admin/events/${fixture.eventId}`);
    await page.getByRole("button", { name: "Copy registration link" }).focus();
    await expect(page.locator("button:focus")).toHaveAccessibleName("Copy registration link");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toContainText(/copied|unavailable/i);
    await page.getByRole("link", { name: "Download QR" }).focus();
    await expect(page.locator("a:focus")).toHaveAccessibleName("Download QR");
  });

  test("supports keyboard-only invitation creation and copy-once feedback", async ({ page }) => {
    const fixture = await systemFixture();
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: process.env.NEXT_PUBLIC_APP_URL!,
    });
    await page.goto("/admin/sign-in");
    await page.getByLabel("Email").fill(fixture.email);
    await page.getByLabel("Password").fill(fixture.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/invitations?mode=invite");
    await page.getByLabel("Email").fill(`keyboard-${fixture.slug}@example.test`);
    await page.locator('select[name="organizationIds"]:visible').focus();
    await page
      .locator('select[name="organizationIds"]:visible')
      .selectOption(fixture.organizationId);
    await page.getByRole("button", { name: "Create invitation" }).click();
    await expect(page.getByRole("textbox", { name: "New invitation link" })).toBeVisible();
    await page.getByRole("button", { name: "Copy link" }).press("Enter");
    await expect(page.getByText("Invitation link copied.", { exact: true })).toBeVisible();
  });
});

test("System Admin can create and list a one-time invitation link", async ({ page }) => {
  const fixture = await systemFixture();
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(fixture.email);
  await page.getByLabel("Password").fill(fixture.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/invitations?mode=invite");
  await page.getByLabel("Email").fill(`invited-${fixture.slug}@example.test`);
  await page.getByLabel("Organization").selectOption(fixture.organizationId);
  await page.getByRole("button", { name: "Create invitation" }).click();
  await expect(page.getByRole("textbox", { name: "New invitation link" })).toBeVisible({
    timeout: 15000,
  });
  await page.reload();
  await expect(page.getByRole("textbox", { name: "New invitation link" })).toHaveCount(0);
  await page.goto("/admin/invitations");
  await expect(page.getByText(`invited-${fixture.slug}@example.test`)).toBeVisible();
});
