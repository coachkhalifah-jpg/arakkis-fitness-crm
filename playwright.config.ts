import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "line",
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry" },
  webServer: {
    command: "./node_modules/.bin/next dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    env: { ...process.env, APP_ENV: "test" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
