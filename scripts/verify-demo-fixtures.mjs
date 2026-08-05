import { execFileSync } from "node:child_process";

if (process.env.APP_ENV === "production") {
  throw new Error("Refusing fixture verification when APP_ENV=production.");
}

const statusOutput = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8" });
const values = Object.fromEntries(
  [...statusOutput.matchAll(/^([A-Z0-9_]+)="(.*)"$/gm)].map((match) => [match[1], match[2]]),
);
if (values.API_URL !== "http://127.0.0.1:54321") {
  throw new Error("Fixture verification requires local Supabase at 127.0.0.1:54321.");
}

const container = execFileSync(
  "docker",
  ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
  { encoding: "utf8" },
).trim();
if (!container) throw new Error("Local Supabase database container is not running.");

const query = `
select
  (select count(*) from auth.users where email like '%@example.test'),
  (select count(*) from public.organizations where active_status = 'ACTIVE'),
  (select count(*) from public.venues where active_status = 'ACTIVE'),
  (select count(*) from public.participants),
  (select count(*) from public.events where status = 'OPEN' and publication_status = 'PUBLISHED'),
  (select count(*) from public.events where capacity = 1),
  (select count(*) from public.events where status = 'CANCELLED'),
  (select count(*) from public.events where publication_status = 'UNPUBLISHED'),
  (select count(*) from public.admin_organization_assignments),
  (select count(*) from public.registrations),
  (select count(*) from public.events where attendance_processing_state = 'FINALIZED');
`;
const output = execFileSync(
  "docker",
  [
    "exec",
    "-i",
    container,
    "psql",
    "-At",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    "postgres",
    "-d",
    "postgres",
  ],
  { input: query, encoding: "utf8" },
).trim();
const actual = output.split("|").map(Number);
const expected = [5, 2, 4, 7, 7, 1, 1, 4, 3, 5, 1];
if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
  throw new Error(`Fixture counts do not match expected local state: ${actual.join(",")}`);
}

console.log(
  "Synthetic local fixture verification passed (no credentials or participant data printed).",
);
