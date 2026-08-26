#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const PORT = 3000;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(`UAT startup refused: ${message}`);
  process.exit(1);
}

function commandOutput(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout : "";
}

function processCwd(pid) {
  if (process.platform === "darwin") {
    const output = commandOutput("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"]);
    const pathLine = output.split("\n").find((line) => line.startsWith("n"));
    return pathLine ? pathLine.slice(1) : null;
  }

  const output = commandOutput("readlink", [`/proc/${pid}/cwd`]).trim();
  return output || null;
}

function listenersOnPort() {
  if (process.platform === "win32") {
    fail("this local UAT guard currently requires macOS or Linux");
  }

  const output = commandOutput("lsof", ["-nP", `-iTCP:${PORT}`, "-sTCP:LISTEN", "-Fpcn"]);
  const listeners = [];
  let current = null;

  for (const line of output.split("\n")) {
    if (line.startsWith("p")) {
      if (current) listeners.push(current);
      current = { pid: Number(line.slice(1)), command: "", endpoint: "" };
    } else if (current && line.startsWith("c")) {
      current.command = line.slice(1);
    } else if (current && line.startsWith("n")) {
      current.endpoint = line.slice(1);
    }
  }
  if (current) listeners.push(current);

  return listeners.map((listener) => ({
    ...listener,
    projectPath: processCwd(listener.pid),
  }));
}

function report(listener, label) {
  console.log(`${label}: PID ${listener.pid}`);
  console.log(`Project path: ${listener.projectPath ?? "unknown"}`);
  console.log(`Endpoint: ${listener.endpoint || `${HOST}:${PORT}`}`);
  console.log(`Command: ${listener.command || "unknown"}`);
}

if (process.versions.node !== "22.22.1") {
  fail(`Node 22.22.1 is required; found ${process.versions.node}`);
}

const pnpmVersion = commandOutput("pnpm", ["--version"]).trim();
if (pnpmVersion !== "10.15.1") {
  fail(`pnpm 10.15.1 is required; found ${pnpmVersion || "unknown"}`);
}

if (!existsSync(resolve(repoRoot, "package.json"))) {
  fail(`could not resolve repository root from ${repoRoot}`);
}

const listeners = listenersOnPort();
const foreignListeners = listeners.filter(
  (listener) =>
    !listener.projectPath || normalize(resolve(listener.projectPath)) !== normalize(repoRoot),
);

if (foreignListeners.length > 0) {
  console.error(
    `Port ${PORT} is already owned by another project; Arakkis will not start elsewhere.`,
  );
  for (const listener of foreignListeners) report(listener, "Conflicting listener");
  process.exit(1);
}

if (listeners.length > 0) {
  for (const listener of listeners) report(listener, "Arakkis already running");
  console.log(`UAT URL: http://${HOST}:${PORT}`);
  process.exit(0);
}

console.log(`Starting Arakkis UAT on http://${HOST}:${PORT}`);
const child = spawn("pnpm", ["exec", "next", "dev", "--hostname", HOST, "--port", String(PORT)], {
  cwd: repoRoot,
  env: { ...process.env, HOSTNAME: HOST, PORT: String(PORT) },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => fail(`could not start Next.js: ${error.message}`));
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

const deadline = Date.now() + 15_000;
while (Date.now() < deadline) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  const running = listenersOnPort();
  const conflict = running.find(
    (listener) =>
      !listener.projectPath || normalize(resolve(listener.projectPath)) !== normalize(repoRoot),
  );
  if (conflict) {
    child.kill("SIGTERM");
    report(conflict, "Conflicting listener");
    fail(`port ${PORT} became owned by another project during startup`);
  }

  const arakkis = running.find(
    (listener) =>
      listener.projectPath && normalize(resolve(listener.projectPath)) === normalize(repoRoot),
  );
  if (arakkis) {
    report(arakkis, "Arakkis running");
    console.log(`UAT URL: http://${HOST}:${PORT}`);
    await new Promise(() => {});
  }
}

child.kill("SIGTERM");
fail(`Next.js did not bind ${HOST}:${PORT} within 15 seconds`);
