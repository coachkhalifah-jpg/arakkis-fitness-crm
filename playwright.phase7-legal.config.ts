import { defineConfig, devices } from "@playwright/test";
import {
  configurePlaywrightEnvironment,
  PLAYWRIGHT_APP_URL,
  PLAYWRIGHT_PORT,
} from "./tests/e2e/test-environment";

configurePlaywrightEnvironment();
process.env.APP_ENV = "production";

export default defineConfig({
  testDir: "./tests/e2e",
  reporter: "line",
  use: { baseURL: PLAYWRIGHT_APP_URL },
  webServer: {
    command: `./node_modules/.bin/next dev --port ${PLAYWRIGHT_PORT}`,
    url: PLAYWRIGHT_APP_URL,
    reuseExistingServer: false,
    env: {
      ...process.env,
      APP_ENV: "production",
      PORT: PLAYWRIGHT_PORT,
      NEXT_DIST_DIR: ".next-playwright",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
