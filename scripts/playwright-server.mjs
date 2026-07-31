import { spawn } from "node:child_process";

const testPort = process.env.PORT || "3100";
const child = spawn("./node_modules/.bin/next", ["dev", "--port", testPort], {
  cwd: process.cwd(),
  env: { ...process.env, APP_ENV: process.env.APP_ENV || "test" },
  stdio: "inherit",
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  child.kill(signal);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGHUP", () => shutdown("SIGHUP"));

child.once("error", (error) => {
  console.error("Playwright web server failed to start:", error);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  if (signal && !shuttingDown) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
