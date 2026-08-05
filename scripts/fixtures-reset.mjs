import { spawnSync } from "node:child_process";

if (process.env.APP_ENV === "production") {
  throw new Error("Refusing to create synthetic fixtures when APP_ENV=production.");
}

const result = spawnSync(process.execPath, ["scripts/demo-reset.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, APP_ENV: "test" },
  stdio: "inherit",
});
if (result.error) throw result.error;
if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);

const verification = spawnSync(process.execPath, ["scripts/verify-demo-fixtures.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, APP_ENV: "test" },
  stdio: "inherit",
});
if (verification.error) throw verification.error;
process.exit(verification.status ?? 1);
