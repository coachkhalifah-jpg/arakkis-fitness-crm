import { execFileSync } from "node:child_process";

const LOCAL_API_URL = "http://127.0.0.1:54321";
export const PLAYWRIGHT_PORT = process.env.PLAYWRIGHT_PORT || "3100";
export const PLAYWRIGHT_APP_URL = `http://127.0.0.1:${PLAYWRIGHT_PORT}`;

function parseStatusEnv(output: string) {
  const values = new Map<string, string>();
  for (const line of output.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"$/);
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

function localSupabaseValues() {
  try {
    const output = execFileSync("supabase", ["status", "-o", "env"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const values = parseStatusEnv(output);
    const apiUrl = values.get("API_URL");
    const anonKey = values.get("ANON_KEY");
    const serviceRoleKey = values.get("SERVICE_ROLE_KEY");
    if (!apiUrl || !anonKey || !serviceRoleKey) {
      throw new Error("local Supabase status did not include the required test values");
    }
    if (apiUrl !== LOCAL_API_URL) {
      throw new Error("browser tests require the local Supabase API at 127.0.0.1:54321");
    }
    return { apiUrl, anonKey, serviceRoleKey };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to load local Supabase test environment: ${detail}`);
  }
}

export function configurePlaywrightEnvironment() {
  const local = localSupabaseValues();
  process.env.APP_ENV = "test";
  process.env.NEXT_PUBLIC_SUPABASE_URL = local.apiUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = local.anonKey;
  process.env.SUPABASE_SERVICE_ROLE_KEY = local.serviceRoleKey;
  process.env.NEXT_PUBLIC_APP_URL = PLAYWRIGHT_APP_URL;
  process.env.APP_BASE_URL = PLAYWRIGHT_APP_URL;
}

export function assertPlaywrightEnvironment() {
  if (process.env.APP_ENV !== "test") {
    throw new Error("Playwright server must run with APP_ENV=test");
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== LOCAL_API_URL) {
    throw new Error("Playwright tests must use the local Supabase API");
  }
  for (const name of [
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_APP_URL",
    "APP_BASE_URL",
  ]) {
    if (!process.env[name]) throw new Error(`Playwright test environment is missing ${name}`);
  }
}
