import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["scripts/demo-reset.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, APP_ENV: "test" },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
