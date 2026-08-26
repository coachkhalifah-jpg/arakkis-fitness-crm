import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

function credentials(label: string) {
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
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("Admin Workspace navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("System Admin has separate keyboard-selectable Organizations and Venues destinations", async ({
    page,
  }) => {
    await signIn(page, credentials("System Admin"));

    await page.getByRole("button", { name: "Open operations menu" }).click();
    const organizations = page.getByRole("link", { name: "Organizations" });
    const venues = page.getByRole("link", { name: "Venues" });
    await expect(organizations).toHaveAttribute("href", "/admin/organizations");
    await expect(venues).toHaveAttribute("href", "/admin/venues");

    await organizations.focus();
    await expect(organizations).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/admin\/organizations$/);

    await page.goto("/admin");
    await page.getByRole("button", { name: "Open operations menu" }).click();
    await venues.focus();
    await expect(venues).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/admin\/venues$/);

    await page.goto("/admin");
    await page.getByRole("button", { name: "Open operations menu" }).click();
    await expect(page.getByText("System Admin", { exact: true })).toBeVisible();
    await expect(page.getByText("All organizations", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Open Calendar options" }).click();
    await expect(page.getByRole("link", { name: "Download this week (.ics)" })).toHaveAttribute(
      "href",
      "/admin/calendar/this-week.ics",
    );
  });

  test("Host Admin sees Venues but no new Organizations destination", async ({ page }) => {
    await signIn(page, credentials("Organization A Host Admin"));
    await page.getByRole("button", { name: "Open operations menu" }).click();
    await expect(page.getByRole("link", { name: "Venues" })).toHaveAttribute(
      "href",
      "/admin/venues",
    );
    await expect(page.getByRole("link", { name: "Organizations" })).not.toBeVisible();
  });
});
