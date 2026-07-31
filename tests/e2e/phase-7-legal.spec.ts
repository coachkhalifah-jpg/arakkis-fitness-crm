import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

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
      "-q",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { input: `begin;\n${statement};\ncommit;\n` },
  );
}

test("production-equivalent public pages remain legally blocked through copied URLs", async ({
  page,
}) => {
  const adminId = randomUUID();
  const organizationId = randomUUID();
  const venueId = randomUUID();
  const eventId = randomUUID();
  const slug = `phase7-legal-${randomUUID().slice(0, 8)}`;
  localSql(`
    insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
    values (${sql(adminId)}, 'authenticated', 'authenticated', ${sql(`${slug}@example.test`)}, now(), now(), now());
    insert into public.admin_profiles (id, display_name, email, role, status)
    values (${sql(adminId)}, 'Phase 7 Legal Fixture', ${sql(`${slug}@example.test`)}, 'SYSTEM_ADMIN', 'ACTIVE');
    insert into public.organizations (id, name) values (${sql(organizationId)}, ${sql(`Phase 7 Legal Organization ${slug}`)});
    insert into public.venues (id, organization_id, name, street, city, state, postal_code, timezone)
    values (${sql(venueId)}, ${sql(organizationId)}, 'Phase 7 Legal Venue', '1 Test Street', 'Albany', 'NY', '12207', 'America/New_York');
    insert into public.events (id, host_organization_id, venue_id, name, description, participant_instructions, starts_at, ends_at, timezone, capacity, registration_deadline, status, visibility, publication_status, public_slug, created_by_admin_id)
    values (${sql(eventId)}, ${sql(organizationId)}, ${sql(venueId)}, 'Phase 7 Legal Event', 'Synthetic legal-gate event.', 'Bring water.', '2099-07-15T14:00:00Z', '2099-07-15T15:00:00Z', 'America/New_York', 20, '2099-07-15T13:00:00Z', 'OPEN', 'PUBLIC', 'PUBLISHED', ${sql(slug)}, ${sql(adminId)});
  `);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/register/${slug}`);
  await expect(page.getByRole("heading", { name: "Phase 7 Legal Event" })).toBeVisible();
  await expect(page.getByText("Registration: LEGALLY BLOCKED")).toBeVisible();
  await expect(page.locator('input[name="publicSlug"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Book Class" })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.locator("body")).toBeVisible();
  await page.goto(`/register/${slug}`);
  await expect(page.getByText("Registration: LEGALLY BLOCKED")).toBeVisible();
});
