import { expect, test } from "@playwright/test";

test("public foundation smoke test", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /foundation is running/i })).toBeVisible();
});
