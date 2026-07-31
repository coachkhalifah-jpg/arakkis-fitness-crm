import { defineConfig, devices } from "@playwright/test";
import {
  configurePlaywrightEnvironment,
  PLAYWRIGHT_APP_URL,
  PLAYWRIGHT_PORT,
} from "./tests/e2e/test-environment";

configurePlaywrightEnvironment();

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/phase-7-legal.spec.ts"],
  // The browser fixtures share one local Supabase database and intentionally exercise mutable
  // authorization/registration state. Serial workers keep the full regression deterministic.
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: PLAYWRIGHT_APP_URL, trace: "on-first-retry" },
  webServer: {
    command: "node scripts/playwright-server.mjs",
    url: PLAYWRIGHT_APP_URL,
    reuseExistingServer: false,
    env: {
      ...process.env,
      APP_ENV: "test",
      PORT: PLAYWRIGHT_PORT,
      NEXT_DIST_DIR: ".next-playwright",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
