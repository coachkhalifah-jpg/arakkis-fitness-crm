import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test.setTimeout(90_000);
const testRunStartedAt = new Date().toISOString();

function systemAdminCredentials() {
  const lines = readFileSync(".demo-credentials.local", "utf8").split("\n");
  const emailIndex = lines.findIndex((value) => value.startsWith("System Admin: "));
  const passwordIndex = emailIndex + 1;
  if (emailIndex < 0 || !lines[passwordIndex]?.startsWith("Password: "))
    throw new Error("Missing System Admin demo credentials");
  return {
    email: lines[emailIndex].slice("System Admin: ".length),
    password: lines[passwordIndex].slice("Password: ".length),
  };
}

function sql(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
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

function localEnv(name: string) {
  const line = readFileSync(".env.local", "utf8")
    .split("\n")
    .find((value) => value.startsWith(`${name}=`));
  return line?.slice(name.length + 1);
}

async function cleanupTestRunObjects() {
  const paths = localQuery(
    `select o.name from storage.objects o where o.bucket_id='design-assets' and o.created_at >= ${sql(testRunStartedAt)} and not exists (select 1 from public.design_assets da where da.storage_path=o.name)`,
  )
    .split("\n")
    .filter(Boolean);
  if (!paths.length) return;
  const storage = createClient(
    localEnv("NEXT_PUBLIC_SUPABASE_URL")!,
    localEnv("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { error } = await storage.storage.from("design-assets").remove(paths);
  if (error) throw new Error(`J5 test cleanup failed: ${error.message}`);
  const remaining = localQuery(
    `select count(*) from storage.objects o where o.bucket_id='design-assets' and o.created_at >= ${sql(testRunStartedAt)} and not exists (select 1 from public.design_assets da where da.storage_path=o.name)`,
  );
  if (remaining !== "0")
    throw new Error(`J5 test cleanup left ${remaining} unreferenced object(s)`);
}

test.afterEach(cleanupTestRunObjects);
test.afterAll(cleanupTestRunObjects);

test("J5 recurring creation is atomic, audited, and rejects cross-organization venues", async ({
  page,
}) => {
  const credentials = systemAdminCredentials();
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const suffix = Date.now().toString(36);
  const imageName = `J5 image ${suffix}`;
  await page.goto("/admin/events?mode=create");
  await page.getByLabel("Name").fill(imageName);
  await page.getByLabel("Organization").selectOption({ label: "Demo Organization A" });
  await page.getByLabel("Venue").selectOption({ label: "Demo Garden Studio (America/New_York)" });
  await page.getByLabel("Local start").fill("2099-08-10T10:00");
  await page.getByLabel("Local end").fill("2099-08-10T11:00");
  await page.getByLabel("Registration deadline").fill("2099-08-10T09:00");
  await page
    .locator('input[name="eventImage"]')
    .setInputFiles("public/admin-assets/event-cards/default.jpg");
  const creationRequestId = await page.locator('input[name="creationRequestId"]').inputValue();
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByRole("status")).toContainText("Draft event created");
  const createdEventLink = page.getByRole("link", { name: "Open the created event" });
  await expect(createdEventLink).toBeVisible();
  const createdEventHref = await createdEventLink.getAttribute("href");
  expect(createdEventHref).toMatch(/^\/admin\/events\/[0-9a-f-]+$/);
  const detailPage = await page.context().newPage();
  await detailPage.goto(createdEventHref!);
  await expect(detailPage.getByText(imageName, { exact: true })).toBeVisible();
  await detailPage.reload();
  await expect(detailPage.getByText(imageName, { exact: true })).toBeVisible();
  const previousStoragePath = localQuery(
    `select da.storage_path from public.design_assets da join public.events e on e.id=da.event_id where e.name=${sql(imageName)} and da.active limit 1`,
  );
  await detailPage
    .locator('input[name="file"]')
    .setInputFiles("public/admin-assets/event-cards/default.jpg");
  await detailPage.getByRole("button", { name: "Upload and activate" }).click();
  await expect(detailPage.getByRole("status")).toContainText("uploaded and activated");
  await detailPage.reload();
  await expect(detailPage.getByText(imageName, { exact: true })).toBeVisible();
  const replacementStoragePath = localQuery(
    `select da.storage_path from public.design_assets da join public.events e on e.id=da.event_id where e.name=${sql(imageName)} and da.active limit 1`,
  );
  await expect(detailPage.locator(`img[src*="${replacementStoragePath}"]`)).toBeVisible();
  const eventsPage = await page.context().newPage();
  await eventsPage.goto("/admin/events");
  const eventCard = eventsPage.locator("article").filter({ hasText: imageName }).first();
  await expect(eventCard).toBeVisible();
  await expect(eventCard.locator(".event-card-media")).toHaveAttribute(
    "style",
    new RegExp(replacementStoragePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  await eventsPage.close();
  await detailPage.goto(createdEventHref!);
  await detailPage.reload();
  await expect(detailPage.locator(`img[src*="${replacementStoragePath}"]`)).toBeVisible();
  expect(
    localQuery(
      `select count(*) from public.design_assets where event_id in (select id from public.events where name=${sql(imageName)}) and asset_type='EVENT_IMAGE_DESKTOP' and active`,
    ),
  ).toBe("1");
  expect(
    localQuery(
      `select count(*) from public.design_assets where storage_path=${sql(previousStoragePath)} and active=false`,
    ),
  ).toBe("1");
  expect(
    localQuery(
      `select count(*) from storage.objects where bucket_id='design-assets' and name=${sql(previousStoragePath)}`,
    ),
  ).toBe("0");
  await detailPage.locator('input[name="file"]').setInputFiles({
    name: "replacement.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("not an image"),
  });
  await detailPage.getByRole("button", { name: "Upload and activate" }).click();
  await expect(
    detailPage.getByText("Use a JPEG, PNG, WebP, or SVG image.", { exact: true }),
  ).toBeVisible();
  expect(
    localQuery(
      `select count(*) from public.design_assets where event_id in (select id from public.events where name=${sql(imageName)}) and asset_type='EVENT_IMAGE_DESKTOP' and active`,
    ),
  ).toBe("1");
  await detailPage.close();
  expect(
    localQuery(
      `select count(*) from public.design_assets da join public.events e on e.id=da.event_id where e.name=${sql(imageName)} and da.active`,
    ),
  ).toBe("1");
  await page
    .locator('input[name="eventImage"]')
    .setInputFiles("public/admin-assets/event-cards/default.jpg");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByRole("status")).toContainText("Draft event created");
  expect(localQuery(`select count(*) from public.events where name=${sql(imageName)}`)).toBe("1");
  expect(
    localQuery(
      `select count(*) from public.design_assets da join public.events e on e.id=da.event_id where e.name=${sql(imageName)} and da.active`,
    ),
  ).toBe("1");
  expect(
    localQuery(
      `select count(*) from storage.objects where bucket_id='design-assets' and name like ${sql(`event_image_staging/${creationRequestId}/%`)}`,
    ),
  ).toBe("0");
  expect(
    localQuery(
      `select count(*) from storage.objects so join public.design_assets da on da.storage_path=so.name join public.events e on e.id=da.event_id where e.name=${sql(imageName)} and so.bucket_id='design-assets'`,
    ),
  ).toBe("1");

  const invalidImageName = `J5 invalid image ${suffix}`;
  await page.goto("/admin/events?mode=create");
  await page.getByLabel("Name").fill(invalidImageName);
  await page.getByLabel("Organization").selectOption({ label: "Demo Organization A" });
  await page.getByLabel("Venue").selectOption({ label: "Demo Garden Studio (America/New_York)" });
  await page.getByLabel("Local start").fill("2099-08-11T10:00");
  await page.getByLabel("Local end").fill("2099-08-11T11:00");
  await page.getByLabel("Registration deadline").fill("2099-08-11T09:00");
  await page.locator('input[name="eventImage"]').setInputFiles({
    name: "not-an-image.jpg",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(
    page.getByText("Use a JPEG, PNG, WebP, or SVG event image.", { exact: true }),
  ).toBeVisible();
  expect(localQuery(`select count(*) from public.events where name=${sql(invalidImageName)}`)).toBe(
    "0",
  );

  const name = `J5 recurring ${suffix}`;
  await page.goto("/admin/events?mode=create");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Organization").selectOption({ label: "Demo Organization A" });
  await page.getByLabel("Venue").selectOption({ label: "Demo Garden Studio (America/New_York)" });
  await page.getByLabel("Local start").fill("2099-08-20T10:00");
  await page.getByLabel("Local end").fill("2099-08-20T11:00");
  await page.getByLabel("Registration deadline").fill("2099-08-20T09:00");
  await page.getByRole("checkbox", { name: "Make this event recurring" }).check();
  await page.getByLabel("Ends").fill("2099-09-03");
  await page
    .locator('input[name="eventImage"]')
    .setInputFiles("public/admin-assets/event-cards/default.jpg");
  const recurringRequestId = await page.locator('input[name="creationRequestId"]').inputValue();
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Recurring series created with 3 weekly dates",
  );

  expect(
    localQuery(
      `select count(*) from public.events where name=${sql(name)} and event_series_id is not null`,
    ),
  ).toBe("3");
  expect(
    localQuery(
      `select count(*) from public.audit_events where action='EVENT_SERIES_CREATED' and new_values->>'name'=${sql(name)}`,
    ),
  ).toBe("1");
  await page
    .locator('input[name="eventImage"]')
    .setInputFiles("public/admin-assets/event-cards/default.jpg");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Recurring series created with 3 weekly dates",
  );
  expect(localQuery(`select count(*) from public.events where name=${sql(name)}`)).toBe("3");
  expect(
    localQuery(
      `select count(*) from public.design_assets da join public.events e on e.id=da.event_id where e.name=${sql(name)} and da.active`,
    ),
  ).toBe("3");
  expect(
    localQuery(
      `select count(*) from storage.objects where bucket_id='design-assets' and name like ${sql(`event_image_staging/${recurringRequestId}/%`)}`,
    ),
  ).toBe("3");

  const invalidName = `J5 invalid ${suffix}`;
  await page.getByLabel("Name").fill(invalidName);
  await page.getByLabel("Organization").selectOption({ label: "Demo Organization A" });
  const crossOrganizationVenueId = localQuery(
    "select id from public.venues where name='Demo Harbor Hall' limit 1",
  );
  await page.getByLabel("Venue").evaluate((select, venueId) => {
    const tampered = document.createElement("option");
    tampered.textContent = "Tampered cross-organization venue";
    tampered.value = venueId;
    (select as HTMLSelectElement).append(tampered);
    (select as HTMLSelectElement).value = tampered.value;
  }, crossOrganizationVenueId);
  await page.getByLabel("Local start").fill("2099-09-10T10:00");
  await page.getByLabel("Local end").fill("2099-09-10T11:00");
  await page.getByLabel("Registration deadline").fill("2099-09-10T09:00");
  await page.getByRole("checkbox", { name: "Make this event recurring" }).uncheck();
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(
    page.getByText("Choose a venue belonging to the selected organization.", { exact: true }),
  ).toBeVisible();
  expect(localQuery(`select count(*) from public.events where name=${sql(invalidName)}`)).toBe("0");
});

test("J5 enforces the 5 MiB image boundary through the application", async ({ page }) => {
  const credentials = systemAdminCredentials();
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const suffix = Date.now().toString(36);
  const nearLimitName = `J5 near-limit ${suffix}`;
  await page.goto("/admin/events?mode=create");
  await page.getByLabel("Name").fill(nearLimitName);
  await page.getByLabel("Organization").selectOption({ label: "Demo Organization A" });
  await page.getByLabel("Venue").selectOption({ label: "Demo Garden Studio (America/New_York)" });
  await page.getByLabel("Local start").fill("2099-08-12T10:00");
  await page.getByLabel("Local end").fill("2099-08-12T11:00");
  await page.getByLabel("Registration deadline").fill("2099-08-12T09:00");
  await page.locator('input[name="eventImage"]').setInputFiles({
    name: "near-limit.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(5 * 1024 * 1024 - 1024, 0x61),
  });
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByRole("status")).toContainText("Draft event created");
  expect(localQuery(`select count(*) from public.events where name=${sql(nearLimitName)}`)).toBe(
    "1",
  );
  expect(
    localQuery(
      `select count(*) from public.design_assets da join public.events e on e.id=da.event_id where e.name=${sql(nearLimitName)} and da.active and da.byte_size=${5 * 1024 * 1024 - 1024}`,
    ),
  ).toBe("1");

  const oversizedName = `J5 oversized ${suffix}`;
  await page.goto("/admin/events?mode=create");
  await page.getByLabel("Name").fill(oversizedName);
  await page.getByLabel("Organization").selectOption({ label: "Demo Organization A" });
  await page.getByLabel("Venue").selectOption({ label: "Demo Garden Studio (America/New_York)" });
  await page.getByLabel("Local start").fill("2099-08-13T10:00");
  await page.getByLabel("Local end").fill("2099-08-13T11:00");
  await page.getByLabel("Registration deadline").fill("2099-08-13T09:00");
  const oversizedRequestId = await page.locator('input[name="creationRequestId"]').inputValue();
  await page.locator('input[name="eventImage"]').setInputFiles({
    name: "oversized.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1024, 0x62),
  });
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(
    page.getByText("Event images must be 5 MiB or smaller.", { exact: true }),
  ).toBeVisible();
  expect(localQuery(`select count(*) from public.events where name=${sql(oversizedName)}`)).toBe(
    "0",
  );
  expect(
    localQuery(
      `select count(*) from public.audit_events where new_values->>'name'=${sql(oversizedName)}`,
    ),
  ).toBe("0");
  expect(
    localQuery(
      `select count(*) from storage.objects where bucket_id='design-assets' and name like ${sql(`event_image_staging/${oversizedRequestId}/%`)}`,
    ),
  ).toBe("0");
});
