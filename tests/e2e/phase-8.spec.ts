import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test.describe.configure({ mode: "serial" });

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function sql(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function acceptRequiredLegal(page: import("@playwright/test").Page) {
  for (const label of [
    /Participation Agreement.*Version 1\.0\.0/,
    /Assumption of Risk.*Version 1\.0\.0/,
    /Cancellation.*Policy.*Version 1\.0\.0/,
    /Terms of Use.*Version 1\.0\.0/,
    /Privacy Policy.*Version 1\.0\.0/,
  ])
    await page.getByLabel(label).check();
}

function localSql(statement: string) {
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
    { input: `begin;\n${statement}\ncommit;\n` },
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
      "-q",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { input: statement, encoding: "utf8" },
  ).trim();
}

test.describe("Phase 8 participant productization", () => {
  let slug: string;
  let eventId: string;
  let eventName: string;
  let displayEventName: string;
  let fixtureSuffix: string;

  test.beforeAll(async () => {
    const service = createClient(
      env("NEXT_PUBLIC_SUPABASE_URL"),
      env("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const suffix = randomUUID().slice(0, 8);
    fixtureSuffix = suffix;
    const version = 9800 + (Number.parseInt(suffix, 16) % 1000);
    const email = `phase8-browser-${suffix}@example.test`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      password: `${randomBytes(24).toString("base64url")}Aa1!`,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error("Could not create Phase 8 browser admin");
    const organizationId = randomUUID();
    const venueId = randomUUID();
    eventId = randomUUID();
    const participationId = randomUUID();
    const dataUseId = randomUUID();
    slug = `phase-eight-${suffix}`;
    eventName = `Phase 8 Community Flow ${suffix}`;
    displayEventName = "Phase 8 Community Flow";
    localSql(`
      insert into public.admin_profiles (id, display_name, email, role, status) values (${sql(data.user.id)}, 'Phase 8 Browser Admin', ${sql(email)}, 'SYSTEM_ADMIN', 'ACTIVE');
      insert into public.organizations (id, name) values (${sql(organizationId)}, ${sql(`Phase 8 Organization ${suffix}`)});
      insert into public.venues (id, organization_id, name, street, city, state, postal_code, timezone) values (${sql(venueId)}, ${sql(organizationId)}, 'Phase 8 Garden Studio', '1 Test Street', 'Albany', 'NY', '12207', 'America/New_York');
      insert into public.events (id, host_organization_id, venue_id, name, description, participant_instructions, starts_at, ends_at, timezone, capacity, registration_deadline, status, visibility, publication_status, public_slug, created_by_admin_id)
      values (${sql(eventId)}, ${sql(organizationId)}, ${sql(venueId)}, ${sql(eventName)}, 'A welcoming synthetic session.', 'Bring water.', '2099-10-15T14:00:00Z', '2099-10-15T15:00:00Z', 'America/New_York', 20, '2099-10-15T13:00:00Z', 'OPEN', 'PUBLIC', 'PUBLISHED', ${sql(slug)}, ${sql(data.user.id)});
      insert into public.acknowledgment_versions (id, type, version, exact_text, content_hash, effective_at, legal_status, created_by_admin_id) values
        (${sql(participationId)}, 'PARTICIPATION_RISK', ${version}, 'Synthetic participation acknowledgment.', decode(repeat('aa', 32), 'hex'), now(), 'PROVISIONAL', ${sql(data.user.id)}),
        (${sql(dataUseId)}, 'DATA_USE', ${version}, 'Synthetic data-use acknowledgment.', decode(repeat('bb', 32), 'hex'), now(), 'APPROVED', ${sql(data.user.id)});
    `);
  });

  test("navigates from landing page to an accessible event card and canonical registration route", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /explore upcoming events/i }).click();
    await expect(page).toHaveURL(/\/events$/);
    const card = page
      .getByRole("article")
      .filter({ has: page.locator(`a[href="/register/${slug}"]`) });
    await expect(card).toBeVisible();
    await expect(
      card.getByRole("link", { name: /view class|view session details/i }),
    ).toHaveAttribute("href", `/register/${slug}`);
    expect(await page.content()).not.toContain(eventId);
    expect(await card.innerText()).not.toContain(fixtureSuffix);
  });

  test("completes the participant journey with keyboard-operable controls", async ({ page }) => {
    await page.goto(`/register/${slug}`);
    await expect(page.getByRole("heading", { name: displayEventName })).toBeVisible();
    expect(await page.locator("main").innerText()).not.toContain(fixtureSuffix);
    await expect(page.getByLabel("Primary affiliation")).toHaveCount(0);
    await expect(page.getByLabel("How did you hear about us? — Optional")).toBeVisible();
    await expect(page.getByText("Save your spot")).toBeVisible();
    await expect(page.getByText("Class details")).toHaveCount(0);
    await expect(page.getByText("Location")).toHaveCount(0);
    await expect(page.locator(".event-hero-status")).toHaveText("open");
    await expect(page.getByText("You’re reserving the class below.")).toBeVisible();
    await expect(page.locator('.registration-slot input[type="checkbox"]')).toBeChecked();
    await expect(page.getByText("SELECTED", { exact: true })).toBeVisible();
    await expect(page.getByText(/class(?:es)? selected/i)).toHaveCount(0);
    await page.getByRole("checkbox", { name: new RegExp(displayEventName) }).check();
    await page.getByLabel("First name").fill("Keyboard");
    await page.getByLabel("Last name").fill("Participant");
    await page.getByLabel("Mobile phone").fill("+15185550199");
    await acceptRequiredLegal(page);
    await page.getByRole("button", { name: /book class/i }).press("Enter");
    await expect(page).toHaveURL(/\/registration\/confirmation\?token=/);
    await expect(page.getByRole("heading", { name: "You're in!" })).toBeVisible();
    await expect(page.getByText(/We’re looking forward to seeing you, Keyboard\./)).toBeVisible();
    await expect(page.getByRole("link", { name: /Google Calendar/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /iCal/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Directions" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy directions" })).toBeVisible();
    const whatToBring = page.getByRole("button", { name: "What to bring", exact: false });
    await expect(whatToBring).toBeVisible();
    await whatToBring.click();
    await expect(page.locator(".confirmation-what-to-bring-content-wrap.is-open")).toBeVisible();
    await page.getByRole("button", { name: "Close What to bring" }).click();
    await expect(page.locator(".confirmation-what-to-bring-content-wrap.is-open")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /download all calendar files/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
    expect(
      localSqlQuery(
        "select count(*) from public.participant_remembered_devices d join public.participants p on p.id=d.participant_id where p.normalized_phone = '+15185550199'",
      ),
    ).toBe("0");
  });

  test("submits a recurring public booking through the canonical series slug", async ({ page }) => {
    const routeText = readFileSync(".demo-routes.local.md", "utf8");
    const recurringSlug = routeText.match(/register\/(demo-recurring-[a-z0-9]+)/)?.[1];
    if (!recurringSlug) throw new Error("The demo recurring route was not generated");

    await page.goto(`/register/${recurringSlug}`);
    const occurrenceChoices = page.locator('input[name="selectedOccurrenceStartsAt"]');
    await expect(occurrenceChoices).toHaveCount(2);
    await occurrenceChoices.first().check();
    await page.getByLabel("First name").fill("Recurring");
    await page.getByLabel("Last name").fill("Regression");
    await page.getByLabel("Mobile phone").fill(`+151855${Date.now().toString().slice(-5)}`);
    await acceptRequiredLegal(page);
    await page.getByRole("button", { name: /book class/i }).click();
    await expect(page).toHaveURL(/\/registration\/confirmation\?token=/);
    await expect(page.getByRole("heading", { name: "You're in!" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Stay connected with your class" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Join class chat/ })).toHaveAttribute(
      "href",
      "https://example.test/demo-group",
    );
  });

  test("remembers, reuses, and forgets a participant browser token safely", async ({ page }) => {
    await page.goto(`/register/${slug}`);
    await page.getByRole("checkbox", { name: new RegExp(displayEventName) }).check();
    await page.getByLabel("First name").fill("Remembered");
    await page.getByLabel("Last name").fill("Participant");
    await page.getByLabel("Mobile phone").fill("+15185550198");
    await acceptRequiredLegal(page);
    await page.getByLabel("Make future bookings faster on this device").check();
    await page.getByRole("button", { name: /book class/i }).click();
    await expect(page).toHaveURL(/\/registration\/confirmation\?token=/);
    await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
    await expect(page.getByText(/securely remember this device/i)).toHaveCount(0);

    const [cookie] = (await page.context().cookies()).filter(
      (item) => item.name === "fitness_remembered_device",
    );
    expect(cookie).toBeTruthy();
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    expect(cookie.path).toBe("/register");
    expect(cookie.value).not.toContain("/");
    expect(cookie.value).not.toContain("?");
    expect(page.url()).not.toContain(cookie.value);

    const service = createClient(
      env("NEXT_PUBLIC_SUPABASE_URL"),
      env("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
    const deviceEvidence = localSqlQuery(
      "select encode(token_hash, 'hex') || '|' || (expires_at > now())::text || '|' || (revoked_at is null)::text from public.participant_remembered_devices order by created_at desc limit 1",
    );
    const [tokenHash, unexpired, notRevoked] = deviceEvidence.split("|");
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).not.toBe(cookie.value);
    expect(unexpired).toBe("true");
    expect(notRevoked).toBe("true");

    const rememberedParticipantId = localSqlQuery(
      "select id from public.participants where normalized_phone = '+15185550198' limit 1",
    );
    if (!rememberedParticipantId) throw new Error("Remembered participant fixture was not created");
    localSql(
      `update public.registrations set registration_status = 'CANCELLED', registration_outcome = 'PARTICIPANT_CANCELLED', cancelled_at = now() where participant_id = '${rememberedParticipantId}' and event_id = '${eventId}';`,
    );

    await page.goto(`/register/${slug}`);
    await expect(page.getByText("Welcome back")).toBeVisible();
    await expect(page.getByLabel("Make future bookings faster on this device")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Continue as Remembered" })).toBeVisible();
    await page.getByRole("checkbox", { name: new RegExp(displayEventName) }).check();
    await acceptRequiredLegal(page);
    await page.getByRole("button", { name: /continue as remembered/i }).click();
    await expect(page).toHaveURL(/\/registration\/confirmation\?token=/);

    await page.goto(`/register/${slug}`);
    await page.getByRole("button", { name: "Forget this device" }).click();
    await page.goto(`/register/${slug}`);
    await expect(page.getByText("Welcome back")).toHaveCount(0);
    expect(
      localSqlQuery(
        "select (revoked_at is not null)::text from public.participant_remembered_devices order by created_at desc limit 1",
      ),
    ).toBe("true");
  });

  test("keeps public surfaces readable on narrow mobile widths", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    for (const route of ["/", "/events", `/register/${slug}`]) {
      await page.goto(route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
    }
  });

  test("shows a calm unavailable state for an invalid slug", async ({ page }) => {
    await page.goto("/register/does-not-exist");
    await expect(page.getByText("This event is unavailable.")).toBeVisible();
    await expect(page.getByRole("heading", { name: /event unavailable/i })).toHaveCount(0);
  });
});
