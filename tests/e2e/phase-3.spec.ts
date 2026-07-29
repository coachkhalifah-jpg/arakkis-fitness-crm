import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

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
    { input: `begin;\n${statement}\ncommit;\n` },
  );
}
function localQuery(statement: string) {
  const container = execFileSync(
    "docker",
    ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
    { encoding: "utf8" },
  ).trim();
  return execFileSync(
    "docker",
    ["exec", container, "psql", "-At", "-U", "postgres", "-d", "postgres", "-c", statement],
    { encoding: "utf8" },
  ).trim();
}
async function signIn(page: Page, email: string, password: string) {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("System Admin completes the Phase 3 operational flow", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const suffix = randomUUID().slice(0, 8);
  const email = `phase3-system-${suffix}@example.test`;
  const password = `${randomBytes(24).toString("base64url")}Aa1!`;
  const organizationName = `Phase 3 Organization ${suffix}`;
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) throw new Error("Could not create synthetic System Admin");
  localSql(
    `insert into public.admin_profiles (id, display_name, email, role, status) values (${sql(authData.user.id)}, 'Phase 3 Browser Admin', ${sql(email)}, 'SYSTEM_ADMIN', 'ACTIVE');`,
  );

  await signIn(page, email, password);
  await page.getByRole("link", { name: "Organizations" }).click();
  await page.getByLabel("Name").fill(organizationName);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByRole("link", { name: organizationName })).toBeVisible();
  await page.getByRole("link", { name: organizationName }).click();
  await page.getByLabel("City").fill("Updated City");
  await page.getByRole("button", { name: "Save organization" }).click();
  await expect(page.getByText("Organization updated.")).toBeVisible();

  await page.goto("/admin/venues");
  await page.getByLabel("Name").fill(`Phase 3 Venue ${suffix}`);
  await page.getByLabel("Organization").selectOption({ label: organizationName });
  await page.getByLabel("Street").fill("1 Test Street");
  await page.getByLabel("City").fill("Updated City");
  await page.getByLabel("State").fill("NY");
  await page.getByLabel("Postal code").fill("10001");
  await page.getByLabel("IANA timezone").fill("America/New_York");
  await page.getByRole("button", { name: "Create venue" }).click();
  const venueName = `Phase 3 Venue ${suffix}`;
  await expect(page.getByRole("link", { name: venueName })).toBeVisible();
  await page.getByRole("link", { name: venueName }).click();
  await page.locator('input[name="timezone"]').fill("America/Chicago");
  await page.getByRole("button", { name: "Save venue" }).click();

  await page.goto("/admin/events");
  await page.getByLabel("Name").fill(`Phase 3 Event ${suffix}`);
  await page.getByLabel("Organization").selectOption({ label: organizationName });
  await page.getByLabel("Venue").selectOption({ label: `${venueName} (America/New_York)` });
  await page.getByLabel("Capacity").fill("20");
  await page.getByLabel("Local start").fill("2099-06-15T10:00");
  await page.getByLabel("Local end").fill("2099-06-15T11:00");
  await page.getByLabel("Registration deadline").fill("2099-06-15T09:00");
  await page.getByRole("button", { name: "Create draft" }).click();
  const eventName = `Phase 3 Event ${suffix}`;
  await expect(page.getByRole("link", { name: eventName })).toBeVisible();
  await page.getByRole("link", { name: eventName }).click();
  await page.getByLabel("Description").fill("Updated operational description");
  await page.getByRole("button", { name: "Save event" }).click();
  await expect(page.getByText("Event updated.")).toBeVisible();
  await page.getByRole("button", { name: "Publish event" }).click();
  await page.waitForTimeout(1000);
  expect(localQuery(`select status from public.events where name=${sql(eventName)}`)).toBe("OPEN");
  await page.getByRole("button", { name: "Copy event" }).click();
  await page.waitForTimeout(1000);
  const copyId = localQuery(
    `select id from public.events where name=${sql(`${eventName} (Copy)`)}`,
  );
  expect(localQuery(`select status from public.events where id=${sql(copyId)}`)).toBe("DRAFT");
  const eventId = localQuery(`select id from public.events where name=${sql(eventName)}`);
  await page.goto(`/admin/events/${eventId}?refresh=${Date.now()}`);
  await page.getByRole("button", { name: "Cancel event" }).click();
  await page.waitForTimeout(1000);
  expect(localQuery(`select status from public.events where name=${sql(eventName)}`)).toBe(
    "CANCELLED",
  );
  await page.goto(`/admin/events/${eventId}?refresh=${Date.now()}`);
  await expect(page.getByText(/permanently cancelled and cannot be restored/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel event" })).toHaveCount(0);
});
