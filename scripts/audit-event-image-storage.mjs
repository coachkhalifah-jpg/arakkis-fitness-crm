#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const bucket = "design-assets";
const deleteConfirmed = process.argv.includes("--delete-confirmed");
const minAgeHours = Number(process.env.EVENT_IMAGE_ORPHAN_MIN_AGE_HOURS ?? "24");

function loadLocalEnv() {
  const values = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
      if (match) values[match[1]] = match[2];
    }
  } catch {
    // Environment variables may be supplied by the caller.
  }
  return { ...values, ...process.env };
}

const env = loadLocalEnv();
const apiUrl = env.NEXT_PUBLIC_SUPABASE_URL;
if (
  env.APP_ENV === "production" ||
  !apiUrl ||
  !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(apiUrl)
) {
  throw new Error("Refusing orphan cleanup outside local Supabase.");
}
if (!Number.isFinite(minAgeHours) || minAgeHours < 0) {
  throw new Error("EVENT_IMAGE_ORPHAN_MIN_AGE_HOURS must be a non-negative number.");
}

const container = execFileSync(
  "docker",
  ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
  { encoding: "utf8" },
).trim();
if (!container) throw new Error("Local Supabase database container is not running.");

const query = `
select coalesce(json_agg(row_to_json(items)), '[]'::json) from (
  select o.bucket_id, o.name, o.created_at, o.updated_at,
         coalesce((o.metadata->>'size')::bigint, 0) as byte_size,
         o.metadata->>'mimetype' as mime_type,
         da.id as design_asset_id, da.event_id, da.active as asset_active,
         (select count(*) from public.audit_events a
            where a.entity_type = 'DESIGN_ASSET' and a.entity_id = da.id) as audit_count
  from storage.objects o
  left join public.design_assets da on da.storage_path = o.name and o.bucket_id = '${bucket}'
  where o.bucket_id = '${bucket}'
  order by o.created_at, o.name
) items;`;
const raw = execFileSync(
  "docker",
  ["exec", container, "psql", "-At", "-U", "postgres", "-d", "postgres", "-c", query],
  { encoding: "utf8" },
).trim();
const objects = raw ? JSON.parse(raw) : [];
const cutoff = Date.now() - minAgeHours * 60 * 60 * 1000;

function classify(object) {
  if (object.design_asset_id) return "referenced through supported model";
  if (new Date(object.created_at).getTime() > cutoff) return "ambiguous—manual review required";
  if (object.name.startsWith("event_image_staging/")) return "confirmed orphan from failed or duplicate operation";
  if (object.name.startsWith("event_image_desktop/")) return "obsolete legacy object";
  return "ambiguous—manual review required";
}

const inventory = objects.map((object) => ({
  ...object,
  request_id: object.name.match(/^event_image_staging\/([^/]+)/)?.[1] ?? null,
  event_id_in_path: object.name.match(/^event_image_staging\/[^/]+\/([^/]+)/)?.[1] ?? null,
  classification: classify(object),
}));
const counts = Object.groupBy(inventory, (item) => item.classification);
console.log(JSON.stringify({ mode: deleteConfirmed ? "delete-confirmed" : "dry-run", minAgeHours, total: inventory.length, counts: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value.length])), objects: inventory }, null, 2));

if (!deleteConfirmed) process.exit(0);
const storage = createClient(apiUrl, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const candidates = inventory.filter((item) =>
  ["confirmed orphan from failed or duplicate operation", "obsolete legacy object"].includes(item.classification) &&
  !item.design_asset_id &&
  new Date(item.created_at).getTime() <= cutoff,
);
let deleted = 0;
for (const candidate of candidates) {
  const { error } = await storage.storage.from(bucket).remove([candidate.name]);
  if (error) console.error(`cleanup failed for ${candidate.name}: ${error.message}`);
  else deleted += 1;
}
console.error(`Deleted ${deleted} confirmed local orphan candidates; retained ${inventory.length - deleted} objects.`);
