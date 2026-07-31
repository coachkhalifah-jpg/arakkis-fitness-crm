import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// The credential file contains repeated Password labels. Resolve them by their account block.
function accountCredentials(label: string) {
  const text = readFileSync(".demo-credentials.local", "utf8");
  const match = text.match(new RegExp(`${label}: ([^\\n]+)\\nPassword: ([^\\n]+)`));
  if (!match) throw new Error(`Missing credentials for ${label}`);
  return { email: match[1], password: match[2] };
}

async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

if (!existsSync(".demo-credentials.local")) {
  test("requires pnpm demo:reset", async () => {
    test.skip(true, "Run pnpm demo:reset before the local demo-auth smoke test.");
  });
} else {
  const system = accountCredentials("System Admin");
  const hostA = accountCredentials("Organization A Host Admin");
  const hostB = accountCredentials("Organization B Host Admin");
  const nonAdmin = accountCredentials("Authenticated non-admin");
  const inactive = accountCredentials("Inactive admin");

  test.describe.serial("local demo authentication", () => {
    test("System Admin has global access and a persistent session", async ({ page }) => {
      await signIn(page, system);
      await expect(page).toHaveURL(/\/admin$/);
      await expect(page.getByText("SYSTEM_ADMIN")).toBeVisible();
      await page.getByRole("link", { name: "Organizations" }).click();
      await expect(page.getByText("Demo Organization A")).toBeVisible();
      await expect(page.getByText("Demo Organization B")).toBeVisible();
      await page.goto("/admin");
      await page.reload();
      await expect(page.getByText(system.email)).toBeVisible();
      await page.getByRole("button", { name: "Sign out" }).click();
      await expect(page).toHaveURL(/\/$/);
    });

    test("both Host Admins are limited to their assigned organization", async ({ page }) => {
      await signIn(page, hostA);
      await expect(page).toHaveURL(/\/admin$/);
      await expect(page.getByText("Demo Organization A")).toBeVisible();
      await page.goto("/admin/events");
      await expect(page.getByText("Demo Weekly Flow — This Week")).toBeVisible();
      await expect(page.getByText("Demo Paused Event")).not.toBeVisible();
      await page.goto("/admin/participants");
      await expect(page).toHaveURL(/\/admin\/access-denied/);
      await page.context().clearCookies();

      await signIn(page, hostB);
      await expect(page).toHaveURL(/\/admin$/);
      await expect(page.getByText("Demo Organization B")).toBeVisible();
      await expect(page.getByText("Demo Organization A")).not.toBeVisible();
      await page.goto("/admin/events");
      await expect(page.getByText("Demo Paused Event")).toBeVisible();
      await expect(page.getByText("Demo Weekly Flow — This Week")).not.toBeVisible();
      await page.context().clearCookies();
    });

    test("non-admin and inactive administrator are denied", async ({ page }) => {
      await signIn(page, nonAdmin);
      await expect(page).toHaveURL(/\/admin\/access-denied/);
      await expect(page.getByText(/does not have active administrator access/i)).toBeVisible();
      await signIn(page, inactive);
      await expect(page).toHaveURL(/\/admin\/access-denied/);
    });
  });
}
