import { expect, test } from "@playwright/test";

test("public landing page smoke test", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /meet with purpose/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /browse events/i })).toHaveAttribute(
    "href",
    "/events",
  );
});

test("unauthenticated admin access redirects to sign in", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin/);
  await expect(page.getByRole("heading", { name: /make room to lead/i })).toBeVisible();
  await expect(page.getByLabel("Email or username")).toBeVisible();
});
