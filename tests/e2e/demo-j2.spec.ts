import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

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

async function acceptRequiredLegal(page: import("@playwright/test").Page) {
  for (const label of [
    /Participation Agreement.*Version 1\.0\.0/,
    /Assumption of Risk.*Version 1\.0\.0/,
    /Cancellation.*Policy.*Version 1\.0\.0/,
    /Terms of Use.*Version 1\.0\.0/,
    /Privacy Policy.*Version 1\.0\.0/,
  ]) {
    await page.getByLabel(label).check();
  }
}

test("J2 matches the seeded returning participant without creating a duplicate", async ({
  page,
}) => {
  const routeText = readFileSync(".demo-routes.local.md", "utf8");
  const slug = routeText.match(/register\/(demo-recurring-[a-z0-9]+)/)?.[1];
  const suffix = slug?.replace("demo-recurring-", "");
  if (!slug || !suffix) throw new Error("The demo recurring route was not generated");

  await page.goto(`/register/${slug}`);
  const nextOccurrence = page.getByRole("checkbox", {
    name: /Demo Weekly Flow — Next Week.*open, not selected/,
  });
  await expect(nextOccurrence).toHaveCount(1);
  await nextOccurrence.check();
  await page.getByLabel("First name").fill("Taylor");
  await page.getByLabel("Last name").fill("Returning");
  await page.getByLabel("Mobile phone").fill("+1 518-867-5309");
  await page.getByLabel("Email (optional)").fill(`taylor-${suffix}@example.test`);
  await acceptRequiredLegal(page);
  await page.getByRole("button", { name: "Book Class" }).click();

  await expect(page).toHaveURL(/\/registration\/confirmation\?token=/);
  await expect(page.getByRole("heading", { name: "You're in!" })).toBeVisible();
  expect(
    localQuery(
      "select count(*) from public.participants where normalized_phone='+15188675309' and normalized_first_name='taylor' and normalized_last_name='returning'",
    ),
  ).toBe("1");
  expect(
    localQuery(
      "select count(*) from public.registrations r join public.participants p on p.id=r.participant_id where p.normalized_phone='+15188675309' and r.registration_status='REGISTERED' and r.registration_outcome='ACTIVE'",
    ),
  ).toBe("2");
});
