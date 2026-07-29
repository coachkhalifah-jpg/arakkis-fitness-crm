import { defineConfig, devices } from "@playwright/test";
import { configurePlaywrightEnvironment } from "./tests/e2e/test-environment";

configurePlaywrightEnvironment();
process.env.APP_ENV = "production";

export default defineConfig({
  testDir: "./tests/e2e",
  reporter: "line",
  use: { baseURL: "http://127.0.0.1:3000" },
  webServer: {
    command: "./node_modules/.bin/next dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    env: { ...process.env, APP_ENV: "production" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
