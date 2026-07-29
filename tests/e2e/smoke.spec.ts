import { expect, test } from "@playwright/test";

test("public foundation smoke test", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /foundation is running/i })).toBeVisible();
});

test("unauthenticated admin access redirects to sign in", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});
