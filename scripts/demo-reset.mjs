import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const localOnly = process.env.APP_ENV !== "production";
if (!localOnly) throw new Error("Refusing to create synthetic demo data in production.");
rmSync(`${root}/.demo-credentials.local`, { force: true });
rmSync(`${root}/.demo-routes.local.md`, { force: true });

function readLocalUatPassword() {
  if (process.env.LOCAL_UAT_PASSWORD) return process.env.LOCAL_UAT_PASSWORD;
  try {
    const localEnv = readFileSync(`${root}/.env.local`, "utf8");
    const match = localEnv.match(/^LOCAL_UAT_PASSWORD=(.*)$/m);
    if (match?.[1]) return match[1].trim();
  } catch {
    // The explicit error below explains the required ignored local setup.
  }
  throw new Error(
    "Set LOCAL_UAT_PASSWORD in ignored .env.local before resetting deterministic UAT fixtures.",
  );
}

const localUatPassword = readLocalUatPassword();

const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const iso = (days, hour = 18) => {
  const date = new Date(Date.now() + days * 86400000);
  date.setUTCMinutes(0, 0, 0);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
};
const dateOnly = (days) => iso(days).slice(0, 10);
const id = () => randomUUID();
const suffix = randomBytes(3).toString("hex");

const statusOutput = execFileSync("supabase", ["status", "-o", "env"], {
  cwd: root,
  encoding: "utf8",
});
const values = Object.fromEntries(
  [...statusOutput.matchAll(/^([A-Z0-9_]+)="(.*)"$/gm)].map((match) => [match[1], match[2]]),
);
if (values.API_URL !== "http://127.0.0.1:54321") {
  throw new Error(
    "Refusing fixture reset: Supabase is not the expected local API at 127.0.0.1:54321.",
  );
}
if (!values.SERVICE_ROLE_KEY) {
  throw new Error("Refusing fixture reset: local Supabase service key is unavailable.");
}
const service = createClient(values.API_URL, values.SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function localSql(statement) {
  const container = execFileSync(
    "docker",
    ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
    { encoding: "utf8" },
  ).trim();
  if (!container) throw new Error("Local Supabase database container is not running.");
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { input: `begin;\n${statement}\ncommit;\n`, stdio: ["pipe", "ignore", "pipe"] },
  );
}

function localQuery(statement) {
  const container = execFileSync(
    "docker",
    ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
    { encoding: "utf8" },
  ).trim();
  if (!container) throw new Error("Local Supabase database container is not running.");
  return execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-At", "-U", "postgres", "-d", "postgres", "-c", statement],
    { encoding: "utf8" },
  ).trim();
}

async function authUser(email, password) {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error(`Could not create ${email}`);
  return data.user.id;
}

const existingDesignAssetPaths = localQuery(
  "select name from storage.objects where bucket_id = 'design-assets'",
)
  .split("\n")
  .filter(Boolean);
if (existingDesignAssetPaths.length) {
  const { error } = await service.storage.from("design-assets").remove(existingDesignAssetPaths);
  if (error)
    throw new Error(`Could not clear local design assets before fixture reset: ${error.message}`);
}

localSql(`
create temp table legal_documents_reset_backup as
select * from public.acknowledgment_versions
where id in (
  '03500000-0000-0000-0000-000000000001'::uuid,
  '03500000-0000-0000-0000-000000000002'::uuid,
  '03500000-0000-0000-0000-000000000003'::uuid,
  '03500000-0000-0000-0000-000000000004'::uuid,
  '03500000-0000-0000-0000-000000000005'::uuid,
  '03500000-0000-0000-0000-000000000006'::uuid,
  '03500000-0000-0000-0000-000000000007'::uuid
);
do $$ declare statement text; begin
  select 'truncate table ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' cascade'
    into statement from pg_tables where schemaname = 'public';
  execute statement;
end $$;
insert into public.acknowledgment_versions select * from legal_documents_reset_backup;
insert into public.legal_packages
  (id, package_version, effective_at, approval_status, content_hash, approved_at)
select
  '04100000-0000-0000-0000-000000000001'::uuid,
  '1.0.0',
  '2026-08-03T00:00:00Z',
  'APPROVED',
  digest(string_agg(c.document_type::text || ':' || v.id::text || ':' || encode(v.content_hash, 'hex'), '|' order by c.document_type), 'sha256'),
  '2026-08-03T00:00:00Z'
from (values
  ('PARTICIPATION_RISK'::public.acknowledgment_type, '03500000-0000-0000-0000-000000000001'::uuid),
  ('LIABILITY_WAIVER'::public.acknowledgment_type, '03500000-0000-0000-0000-000000000002'::uuid),
  ('CANCELLATION_POLICY'::public.acknowledgment_type, '03500000-0000-0000-0000-000000000003'::uuid),
  ('TERMS_OF_USE'::public.acknowledgment_type, '03500000-0000-0000-0000-000000000004'::uuid),
  ('PRIVACY_POLICY'::public.acknowledgment_type, '03500000-0000-0000-0000-000000000005'::uuid)
) as c(document_type, acknowledgment_version_id)
join public.acknowledgment_versions v on v.id = c.acknowledgment_version_id;
insert into public.legal_package_components (legal_package_id, document_type, acknowledgment_version_id)
values
  ('04100000-0000-0000-0000-000000000001', 'PARTICIPATION_RISK', '03500000-0000-0000-0000-000000000001'),
  ('04100000-0000-0000-0000-000000000001', 'LIABILITY_WAIVER', '03500000-0000-0000-0000-000000000002'),
  ('04100000-0000-0000-0000-000000000001', 'CANCELLATION_POLICY', '03500000-0000-0000-0000-000000000003'),
  ('04100000-0000-0000-0000-000000000001', 'TERMS_OF_USE', '03500000-0000-0000-0000-000000000004'),
  ('04100000-0000-0000-0000-000000000001', 'PRIVACY_POLICY', '03500000-0000-0000-0000-000000000005');
insert into public.acknowledgment_versions
  (id, type, version, exact_text, content_hash, effective_at, legal_status, created_by_admin_id)
values
  (${sql(eokeWaiverId)}, 'EOKE_PARTICIPATION_WAIVER', 1000, ${sql(eokeWaiverText)}, digest(${sql(eokeWaiverText)}, 'sha256'), '2026-08-27T00:00:00Z', 'APPROVED', null);
insert into public.legal_packages
  (id, package_version, effective_at, approval_status, content_hash, approved_at, owner_approval_status, owner_approval_date, provenance)
values
  (${sql(eokePackageId)}, '1.0', '2026-08-27T00:00:00Z', 'APPROVED',
   digest('EOKE_PARTICIPATION_WAIVER:' || ${sql(eokeWaiverId)} || ':' || encode((select content_hash from public.acknowledgment_versions where id = ${sql(eokeWaiverId)}), 'hex'), 'sha256'),
   '2026-08-25T00:00:00Z', 'OWNER APPROVED', '2026-08-25',
   'Adapted from lawyer-approved boxing waiver supplied by Product Owner; Eoke-specific adaptations approved by Owner; independent attorney approval of adaptations not claimed.');
insert into public.legal_package_components (legal_package_id, document_type, acknowledgment_version_id)
values (${sql(eokePackageId)}, 'EOKE_PARTICIPATION_WAIVER', ${sql(eokeWaiverId)});
delete from auth.users;
`);

const accounts = [
  ["systemAdmin", "system@test.local", "Demo System Administrator", "SYSTEM_ADMIN", "ACTIVE"],
  ["hostAdminA", "hosta@test.local", "Demo Organization A Admin", "HOST_ADMIN", "ACTIVE"],
  ["hostAdminB", "hostb@test.local", "Demo Organization B Admin", "HOST_ADMIN", "ACTIVE"],
  [
    "hostAdminEmpty",
    "emptyhost@test.local",
    "Demo Empty Organization Host Admin",
    "HOST_ADMIN",
    "ACTIVE",
  ],
  [
    "nonAdmin",
    `demo-participant-${suffix}@example.test`,
    "Authenticated Demo Participant",
    null,
    null,
  ],
  [
    "inactiveAdmin",
    `demo-inactive-${suffix}@example.test`,
    "Inactive Demo Administrator",
    "HOST_ADMIN",
    "DEACTIVATED",
  ],
];
const authAccounts = {};
for (const [key, email, displayName, role, status] of accounts) {
  const password = ["systemAdmin", "hostAdminA", "hostAdminB", "hostAdminEmpty"].includes(key)
    ? localUatPassword
    : `Demo-${randomBytes(18).toString("base64url")}!`;
  const authId = await authUser(email, password);
  authAccounts[key] = { id: authId, email, password, displayName, role, status };
}

const orgA = id();
const orgB = id();
const orgEmpty = id();
const orgInactive = id();
const venueA = id();
const venueA2 = id();
const venueB = id();
const venueB2 = id();
const venueEmpty = id();
const venueInactive = id();
const participantNew = id();
const participantReturning = id();
const participantExisting = id();
const participantWalkIn = id();
const participantCapacity = id();
const participantFirst = id();
const participantOtherOrg = id();
const ackParticipation = id();
const ackDataUse = id();
const ackWhatsApp = id();
const eokeWaiverId = "06400000-0000-0000-0000-000000000001";
const eokePackageId = "06400000-0000-0000-0000-000000000001";
const eokeWaiverText = readFileSync(
  `${root}/supabase/migrations/0064_pilot_single_waiver_legal_package.sql`,
  "utf8",
).match(/\$p\$\n([\s\S]*?)\n\$p\$/)?.[1];
if (!eokeWaiverText) throw new Error("Canonical Eoke waiver text is missing from migration 0064.");
const series = id();
const seriesRule = id();
const recurringEvents = [0, 7, 14].map(() => id());
const eventIds = {
  open: recurringEvents[0],
  recurringSecond: recurringEvents[1],
  recurringThird: recurringEvents[2],
  full: id(),
  paused: id(),
  notYetOpen: id(),
  closed: id(),
  cancelled: id(),
  unpublished: id(),
  noCommunication: id(),
  draft: id(),
  reopened: id(),
  completed: id(),
};
const groupReturning = id();
const groupFirst = id();
const groupNoShow = id();
const communityMilestoneTask = id();
const communityWelcomeTask = id();
const communityReminderPreview = id();
const communityReminderCheckIn = id();
const communityReminderReflection = id();
const communityReminderWelcome = id();
const communityReminderMilestone = id();
const communityReminderChallenge = id();
const communityReminderCompleted = id();
const regReturning = id();
const regFirst = id();
const regNoShow = id();
const regRecurringFull = id();
const attendanceReturning = id();
const attendanceNoShow = id();
const invited = id();
const expired = id();
const revoked = id();
const token = () => randomBytes(32).toString("hex");
const invitationToken = token();
const expiredToken = token();
const revokedToken = token();

const profileRows = accounts
  .filter(([, , , role]) => role)
  .map(([key, , , role, status]) => {
    const account = authAccounts[key];
    return `(${sql(account.id)}, ${sql(account.displayName)}, ${sql(account.email)}, ${sql(role)}, ${sql(account.status)})`;
  })
  .join(",\n");
const event = (eventId, name, days, status, slug, extras = {}) =>
  `(${sql(eventId)}, ${sql(extras.org ?? orgA)}, ${sql(extras.venue ?? venueA)}, ${sql(name)}, ${sql(extras.description ?? "Synthetic pilot fixture for owner testing.")}, ${sql(extras.instructions ?? "Bring water and arrive 10 minutes early.")}, ${sql(iso(days))}, ${sql(iso(days, 19))}, 'America/New_York', ${extras.capacity ?? 20}, ${sql(iso(days, 17))}, ${sql(status)}, ${sql(extras.visibility ?? "PUBLIC")}, ${sql(extras.publication ?? (status === "OPEN" ? "PUBLISHED" : "UNPUBLISHED"))}, ${slug ? sql(slug) : "null"}, ${extras.communicationUrl ? sql(extras.communicationUrl) : "null"}, ${extras.communicationLabel ? sql(extras.communicationLabel) : "null"}, ${sql(authAccounts.systemAdmin.id)}, ${extras.eventSeries ? sql(extras.eventSeries) : "null"}, ${extras.occurrence ?? "null"})`;

const statement = `
insert into public.admin_profiles (id, display_name, email, role, status) values
${profileRows};
insert into public.organizations (id, name, organization_type, city, state, active_status) values
  (${sql(orgA)}, 'Demo Organization A', 'Community Center', 'Albany', 'NY', 'ACTIVE'),
  (${sql(orgB)}, 'Demo Organization B', 'Place of Worship', 'Buffalo', 'NY', 'ACTIVE'),
  (${sql(orgEmpty)}, 'Demo Empty Organization', 'QA Fixture', 'Syracuse', 'NY', 'ACTIVE'),
  (${sql(orgInactive)}, 'Demo Inactive Organization', 'Archived Partner', 'Rochester', 'NY', 'INACTIVE');
insert into public.admin_organization_assignments (admin_profile_id, organization_id, created_by_admin_id) values
  (${sql(authAccounts.hostAdminA.id)}, ${sql(orgA)}, ${sql(authAccounts.systemAdmin.id)}),
  (${sql(authAccounts.hostAdminB.id)}, ${sql(orgB)}, ${sql(authAccounts.systemAdmin.id)}),
  (${sql(authAccounts.hostAdminEmpty.id)}, ${sql(orgEmpty)}, ${sql(authAccounts.systemAdmin.id)}),
  (${sql(authAccounts.inactiveAdmin.id)}, ${sql(orgA)}, ${sql(authAccounts.systemAdmin.id)});
insert into public.venues (id, organization_id, name, street, city, state, postal_code, timezone, active_status) values
  (${sql(venueA)}, ${sql(orgA)}, 'Demo Garden Studio', '1 Test Street', 'Albany', 'NY', '12207', 'America/New_York', 'ACTIVE'),
  (${sql(venueA2)}, ${sql(orgA)}, 'Demo Loft Studio', '4 Test Street', 'Albany', 'NY', '12207', 'America/New_York', 'ACTIVE'),
  (${sql(venueB)}, ${sql(orgB)}, 'Demo River Room', '2 Test Street', 'Buffalo', 'NY', '14201', 'America/New_York', 'ACTIVE'),
  (${sql(venueB2)}, ${sql(orgB)}, 'Demo Harbor Hall', '5 Test Street', 'Buffalo', 'NY', '14201', 'America/New_York', 'ACTIVE'),
  (${sql(venueEmpty)}, ${sql(orgEmpty)}, 'Demo Empty Room', '6 Test Street', 'Syracuse', 'NY', '13202', 'America/New_York', 'ACTIVE'),
  (${sql(venueInactive)}, ${sql(orgInactive)}, 'Inactive Demo Venue', '3 Test Street', 'Rochester', 'NY', '14604', 'America/New_York', 'INACTIVE');
insert into public.acknowledgment_versions (id, type, version, exact_text, content_hash, effective_at, legal_status, created_by_admin_id) values
  (${sql(ackParticipation)}, 'PARTICIPATION_RISK', 9000, 'Synthetic participation acknowledgment for local testing only.', decode(repeat('aa', 32), 'hex'), now(), 'PROVISIONAL', ${sql(authAccounts.systemAdmin.id)}),
  (${sql(ackDataUse)}, 'DATA_USE', 9000, 'Synthetic data-use acknowledgment for local testing only.', decode(repeat('bb', 32), 'hex'), now(), 'APPROVED', ${sql(authAccounts.systemAdmin.id)}),
  (${sql(ackWhatsApp)}, 'WHATSAPP_DISCLOSURE', 9000, 'Synthetic WhatsApp disclosure for local testing only.', decode(repeat('cc', 32), 'hex'), now(), 'APPROVED', ${sql(authAccounts.systemAdmin.id)});
insert into public.event_series (id, frequency, interval_count, ends_on, selection_window_days, public_slug, created_by_admin_id)
values (${sql(series)}, 'WEEKLY', 1, ${sql(dateOnly(16))}, 14, ${sql(`demo-recurring-${suffix}`)}, ${sql(authAccounts.systemAdmin.id)});
insert into public.events (id, host_organization_id, venue_id, name, description, participant_instructions, starts_at, ends_at, timezone, capacity, registration_deadline, status, visibility, publication_status, public_slug, communication_url, communication_label, created_by_admin_id, event_series_id, series_occurrence_number)
values
  ${event(recurringEvents[0], "Demo Weekly Flow", 2, "OPEN", null, { eventSeries: series, communicationUrl: "https://example.test/demo-group", communicationLabel: "Open the demo group" })},
  ${event(recurringEvents[1], "Demo Weekly Flow", 9, "OPEN", null, { eventSeries: series, communicationUrl: "https://example.test/demo-group", communicationLabel: "Open the demo group" })},
  ${event(recurringEvents[2], "Demo Weekly Flow", 16, "OPEN", null, { eventSeries: series, communicationUrl: "https://example.test/demo-group", communicationLabel: "Open the demo group" })},
  ${event(eventIds.full, "Demo Full Event", 4, "OPEN", `demo-full-${suffix}`, { capacity: 1 })},
  ${event(eventIds.paused, "Demo Paused Event", 5, "OPEN", `demo-paused-${suffix}`, { org: orgB, venue: venueB })},
  ${event(eventIds.notYetOpen, "Demo Not Yet Open", 6, "OPEN", `demo-not-yet-open-${suffix}`, { extras: null })},
  ${event(eventIds.closed, "Demo Closed Event", 7, "CLOSED", `demo-closed-${suffix}`)},
  ${event(eventIds.cancelled, "Demo Cancelled Event", 8, "CANCELLED", `demo-cancelled-${suffix}`, { org: orgB, venue: venueB })},
  ${event(eventIds.unpublished, "Demo Unpublished Event", 9, "OPEN", `demo-unpublished-${suffix}`, { publication: "UNPUBLISHED" })},
  ${event(eventIds.noCommunication, "Demo Event Without Communication Link", 10, "OPEN", `demo-no-communication-${suffix}`)},
  ${event(eventIds.draft, "Demo Draft Event", 11, "DRAFT", null)},
  ${event(eventIds.reopened, "Demo Reopened Event", 12, "OPEN", `demo-reopened-${suffix}`)},
  ${event(eventIds.completed, "Demo Completed Event", -3, "COMPLETED", null, { capacity: 20 })};
update public.events set event_series_id = ${sql(series)}, series_occurrence_number = 1 where id = ${sql(recurringEvents[0])};
update public.events set event_series_id = ${sql(series)}, series_occurrence_number = 2 where id = ${sql(recurringEvents[1])};
update public.events set event_series_id = ${sql(series)}, series_occurrence_number = 3 where id = ${sql(recurringEvents[2])};
insert into public.event_series_schedule_rules
  (id, event_series_id, weekday, local_start_time, local_end_time, effective_start_date, effective_end_date, created_by_admin_id)
select
  ${sql(seriesRule)},
  ${sql(series)},
  extract(isodow from (starts_at at time zone timezone))::smallint,
  (starts_at at time zone timezone)::time,
  (ends_at at time zone timezone)::time,
  (starts_at at time zone timezone)::date,
  (select ends_on from public.event_series where id = ${sql(series)}),
  ${sql(authAccounts.systemAdmin.id)}
from public.events
where id = ${sql(recurringEvents[0])};
update public.events
set schedule_rule_id = ${sql(seriesRule)},
    generated_local_date = (starts_at at time zone timezone)::date
where event_series_id = ${sql(series)};
update public.events set registration_opens_at = ${sql(iso(1))} where id = ${sql(eventIds.notYetOpen)};
update public.events set registration_paused_at = now() where id = ${sql(eventIds.paused)};
update public.events set attendance_processing_state = 'REOPENED' where id = ${sql(eventIds.reopened)};
insert into public.participants (id, first_name, last_name, normalized_first_name, normalized_last_name, display_phone, normalized_phone, phone_country, email, primary_affiliation_organization_id)
values
  (${sql(participantNew)}, 'Alex', 'New', 'alex', 'new', '+15550001000', '+15550001000', 'US', 'alex-${suffix}@example.test', ${sql(orgA)}),
  (${sql(participantReturning)}, 'Taylor', 'Returning', 'taylor', 'returning', '+15188675309', '+15188675309', 'US', 'taylor-${suffix}@example.test', ${sql(orgA)}),
  (${sql(participantExisting)}, 'Morgan', 'Registered', 'morgan', 'registered', '+15550001004', '+15550001004', 'US', 'morgan-${suffix}@example.test', ${sql(orgB)}),
  (${sql(participantWalkIn)}, 'Riley', 'Walkin', 'riley', 'walkin', '+15550001005', '+15550001005', 'US', 'riley-${suffix}@example.test', ${sql(orgB)}),
  (${sql(participantCapacity)}, 'Jamie', 'Capacity', 'jamie', 'capacity', '+15550001006', '+15550001006', 'US', 'jamie-${suffix}@example.test', ${sql(orgA)}),
  (${sql(participantFirst)}, 'Jordan', 'Firsttime', 'jordan', 'firsttime', '+15550001002', '+15550001002', 'US', 'jordan-${suffix}@example.test', ${sql(orgA)}),
  (${sql(participantOtherOrg)}, 'Casey', 'Crossvenue', 'casey', 'crossvenue', '+15550001003', '+15550001003', 'US', 'casey-${suffix}@example.test', ${sql(orgA)});
insert into public.registration_groups (id, participant_id, submission_source, participation_acknowledgment_version_id, participation_acknowledged_at, data_use_acknowledgment_version_id, data_use_acknowledged_at, created_by_admin_id)
values
  (${sql(id())}, ${sql(participantExisting)}, 'SYSTEM_ADMIN', ${sql(ackParticipation)}, now(), ${sql(ackDataUse)}, now(), ${sql(authAccounts.systemAdmin.id)}),
  (${sql(id())}, ${sql(participantCapacity)}, 'SYSTEM_ADMIN', ${sql(ackParticipation)}, now(), ${sql(ackDataUse)}, now(), ${sql(authAccounts.systemAdmin.id)}),
  (${sql(groupReturning)}, ${sql(participantReturning)}, 'SYSTEM_ADMIN', ${sql(ackParticipation)}, now(), ${sql(ackDataUse)}, now(), ${sql(authAccounts.systemAdmin.id)}),
  (${sql(groupFirst)}, ${sql(participantFirst)}, 'SYSTEM_ADMIN', ${sql(ackParticipation)}, now(), ${sql(ackDataUse)}, now(), ${sql(authAccounts.systemAdmin.id)}),
  (${sql(groupNoShow)}, ${sql(participantOtherOrg)}, 'SYSTEM_ADMIN', ${sql(ackParticipation)}, now(), ${sql(ackDataUse)}, now(), ${sql(authAccounts.systemAdmin.id)});
insert into public.registrations (id, registration_group_id, participant_id, event_id, affiliation_organization_id_at_registration, registration_status, registration_outcome, created_by_admin_id, whatsapp_opt_in, whatsapp_opt_in_at, whatsapp_disclosure_version_id, whatsapp_invitation_status)
values
  (${sql(id())}, (select id from public.registration_groups where participant_id = ${sql(participantExisting)}), ${sql(participantExisting)}, ${sql(eventIds.open)}, ${sql(orgB)}, 'REGISTERED', 'ACTIVE', ${sql(authAccounts.systemAdmin.id)}, false, null, null, 'NOT_APPLICABLE'),
  (${sql(id())}, (select id from public.registration_groups where participant_id = ${sql(participantCapacity)}), ${sql(participantCapacity)}, ${sql(eventIds.full)}, ${sql(orgA)}, 'REGISTERED', 'ACTIVE', ${sql(authAccounts.systemAdmin.id)}, false, null, null, 'NOT_APPLICABLE'),
  (${sql(regReturning)}, ${sql(groupReturning)}, ${sql(participantReturning)}, ${sql(eventIds.open)}, ${sql(orgA)}, 'REGISTERED', 'ACTIVE', ${sql(authAccounts.systemAdmin.id)}, true, now(), ${sql(ackWhatsApp)}, 'PENDING'),
  (${sql(regRecurringFull)}, (select id from public.registration_groups where participant_id = ${sql(participantCapacity)}), ${sql(participantCapacity)}, ${sql(eventIds.recurringThird)}, ${sql(orgA)}, 'REGISTERED', 'ACTIVE', ${sql(authAccounts.systemAdmin.id)}, false, null, null, 'NOT_APPLICABLE'),
  (${sql(regFirst)}, ${sql(groupFirst)}, ${sql(participantFirst)}, ${sql(eventIds.noCommunication)}, ${sql(orgA)}, 'REGISTERED', 'ACTIVE', ${sql(authAccounts.systemAdmin.id)}, false, null, null, 'NOT_APPLICABLE'),
  (${sql(regNoShow)}, ${sql(groupNoShow)}, ${sql(participantOtherOrg)}, ${sql(eventIds.completed)}, ${sql(orgA)}, 'REGISTERED', 'ACTIVE', ${sql(authAccounts.systemAdmin.id)}, false, null, null, 'NOT_APPLICABLE');
update public.events set attendance_processing_state = 'FINALIZED' where id = ${sql(eventIds.completed)};
update public.events set attendance_processing_state = 'OPEN' where id = ${sql(eventIds.open)};
insert into public.attendance (id, registration_id, status, checked_in_at, finalized_at, updated_by_admin_id)
values (${sql(attendanceReturning)}, ${sql(regReturning)}, 'ATTENDED', now(), now(), ${sql(authAccounts.systemAdmin.id)}),
       (${sql(attendanceNoShow)}, ${sql(regNoShow)}, 'NO_SHOW', null, now(), ${sql(authAccounts.systemAdmin.id)});
update public.follow_up_tasks
set status = 'COMPLETED', completed_at = now(), completed_by_admin_id = ${sql(authAccounts.systemAdmin.id)}, completion_outcome = 'CONTACTED'
where trigger_key = ${sql(`no-show:${regNoShow}`)};
update public.follow_up_tasks
set task_title = 'Welcome Taylor after a first class',
    task_description = 'Send a warm follow-up after Taylor’s first attended session.',
    suggested_message = 'Hi Taylor, it was great having you at Demo Weekly Flow. How did the session feel? We would love to see you again.',
    template_key = 'uat-welcome-after-first-class'
where trigger_key = ${sql(`first-attendance:${participantReturning}`)};
update public.follow_up_tasks
set task_title = 'Reconnect with Casey after a missed class',
    task_description = 'Offer Casey a low-pressure path back after a finalized no-show.',
    suggested_message = 'Hi Casey, we missed you at Demo Completed Event. If you would like help finding another class, we are happy to help.',
    template_key = 'uat-reconnect-after-no-show'
where trigger_key = ${sql(`no-show:${regNoShow}`)};
insert into public.follow_up_tasks
  (id, participant_id, organization_id, event_id, reason, trigger_key, due_at, status,
   task_title, task_description, template_key, suggested_message)
values
  (${sql(communityMilestoneTask)}, ${sql(participantReturning)}, ${sql(orgA)}, ${sql(eventIds.recurringSecond)}, 'FIRST_ATTENDANCE',
   'uat-third-class-milestone', ${sql(iso(1, 15))}, 'PENDING',
   'Celebrate Taylor’s third class', 'Recognize a returning participant and invite the next step.', 'uat-third-class-milestone-v1',
   'Hi Taylor, three classes is a great rhythm. What would you like to explore next?'),
  (${sql(communityWelcomeTask)}, ${sql(participantFirst)}, ${sql(orgA)}, ${sql(eventIds.noCommunication)}, 'FIRST_ATTENDANCE',
   'uat-welcome-jordan', ${sql(iso(2, 14))}, 'PENDING',
   'Welcome Jordan to the community', 'Follow up with a first-time participant whose event has no external group link.', 'uat-welcome-v1',
   'Hi Jordan, welcome to the community. We hope your first session felt inviting—let us know how we can support your next visit.');
insert into public.group_chat_reminders
  (id, organization_id, event_id, reminder_type, trigger_key, due_at, status, suggested_message)
values
  (${sql(communityReminderPreview)}, ${sql(orgA)}, ${sql(eventIds.open)}, 'CLASS_PREVIEW', 'uat-class-preview-weekly-flow', ${sql(iso(0, 10))}, 'PENDING',
   'Tomorrow at 6:00 PM: Demo Weekly Flow is at Demo Garden Studio. Bring water and arrive a few minutes early.'),
  (${sql(communityReminderCheckIn)}, ${sql(orgA)}, ${sql(eventIds.recurringSecond)}, 'ATTENDANCE_CHECK_IN', 'uat-attendance-check-in-weekly-flow', ${sql(iso(1, 11))}, 'PENDING',
   'We are looking forward to seeing everyone at Demo Weekly Flow. Reply here if you need help finding the studio.'),
  (${sql(communityReminderReflection)}, ${sql(orgA)}, ${sql(eventIds.open)}, 'POST_CLASS_REFLECTION', 'uat-post-class-reflection-weekly-flow', ${sql(iso(2, 16))}, 'PENDING',
   'How did today’s class feel? Share one thing you enjoyed or one question for the next session.'),
  (${sql(communityReminderWelcome)}, ${sql(orgA)}, ${sql(eventIds.noCommunication)}, 'WELCOME_FIRST_TIME', 'uat-welcome-first-time-jordan', ${sql(iso(3, 12))}, 'PENDING',
   'Please welcome Jordan to the community after their first visit and help them find a next class.'),
  (${sql(communityReminderMilestone)}, ${sql(orgA)}, ${sql(eventIds.recurringThird)}, 'THIRD_CLASS_MILESTONE', 'uat-third-class-milestone-group', ${sql(iso(4, 13))}, 'PENDING',
   'Taylor is approaching a third class. Celebrate the milestone and invite the group to keep the momentum going.'),
  (${sql(communityReminderChallenge)}, ${sql(orgB)}, ${sql(eventIds.paused)}, 'WEEKLY_CHALLENGE', 'uat-weekly-challenge-river-room', ${sql(iso(5, 9))}, 'PENDING',
   'This week’s gentle challenge: make time for one intentional movement break and tell the group how it went.'),
  (${sql(communityReminderCompleted)}, ${sql(orgB)}, ${sql(eventIds.completed)}, 'POST_CLASS_REFLECTION', 'uat-completed-reflection-river-room', ${sql(iso(-1, 16))}, 'PENDING',
   'What did the group take away from the session at Demo River Room?');
update public.group_chat_reminders
set status = 'COMPLETED', completed_at = now(), completed_by_admin_id = ${sql(authAccounts.systemAdmin.id)}, completion_outcome = 'CONTACTED',
    completion_notes = 'Shared the reflection prompt with the group.'
where id = ${sql(communityReminderCompleted)};
insert into public.admin_invitations (id, invited_email, role, status, token_hash, token_expires_at, invited_by_admin_id)
values
  (${sql(invited)}, 'pending-${suffix}@example.test', 'HOST_ADMIN', 'PENDING', decode(${sql(invitationToken)}, 'hex'), now() + interval '3 days', ${sql(authAccounts.systemAdmin.id)}),
  (${sql(expired)}, 'expired-${suffix}@example.test', 'HOST_ADMIN', 'EXPIRED', decode(${sql(expiredToken)}, 'hex'), now() - interval '1 day', ${sql(authAccounts.systemAdmin.id)}),
  (${sql(revoked)}, 'revoked-${suffix}@example.test', 'HOST_ADMIN', 'REVOKED', decode(${sql(revokedToken)}, 'hex'), now() + interval '3 days', ${sql(authAccounts.systemAdmin.id)});
insert into public.admin_invitation_organizations (invitation_id, organization_id)
values (${sql(invited)}, ${sql(orgA)}), (${sql(expired)}, ${sql(orgB)}), (${sql(revoked)}, ${sql(orgA)});
`;

localSql(statement);

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000";
const credentialsPath = ".demo-credentials.local";
const routesPath = ".demo-routes.local.md";
const credentialText = `# LOCAL-ONLY synthetic demo credentials\n# Replaced by every pnpm demo:reset. Never commit or use outside local development.\n\nAdmin sign-in: ${baseUrl}/admin/sign-in\nSystem Admin: ${authAccounts.systemAdmin.email}\nPassword: ${authAccounts.systemAdmin.password}\nOrganization A Host Admin: ${authAccounts.hostAdminA.email}\nPassword: ${authAccounts.hostAdminA.password}\nOrganization B Host Admin: ${authAccounts.hostAdminB.email}\nPassword: ${authAccounts.hostAdminB.password}\nEmpty Organization Host Admin: ${authAccounts.hostAdminEmpty.email}\nPassword: ${authAccounts.hostAdminEmpty.password}\nAuthenticated non-admin: ${authAccounts.nonAdmin.email}\nPassword: ${authAccounts.nonAdmin.password}\nInactive admin: ${authAccounts.inactiveAdmin.email}\nPassword: ${authAccounts.inactiveAdmin.password}\n\nOpen event: ${baseUrl}/register/${`demo-recurring-${suffix}`}\nRecurring event hub: ${baseUrl}/register/${`demo-recurring-${suffix}`}\nFull event: ${baseUrl}/register/demo-full-${suffix}\nPaused event: ${baseUrl}/register/demo-paused-${suffix}\nNot-yet-open event: ${baseUrl}/register/demo-not-yet-open-${suffix}\nClosed event: ${baseUrl}/register/demo-closed-${suffix}\nNo-communication event: ${baseUrl}/register/demo-no-communication-${suffix}\nInvitations: ${baseUrl}/admin/invitations\n`;
writeFileSync(`${root}/${credentialsPath}`, credentialText, { mode: 0o600 });
const routesText = `# Local synthetic Product Owner Manual UAT reference\n\nGenerated by pnpm fixtures:reset; read alongside docs/37-pilot-manual-testing.md.\n\nApplication: ${baseUrl}\nAdmin sign-in: ${baseUrl}/admin/sign-in\nShared local-only password: test123 (also stored as LOCAL_UAT_PASSWORD in ignored .env.local)\n\n## Personas\n\n- System Admin: system@test.local — start at ${baseUrl}/admin\n- Host Admin A: hosta@test.local — start at ${baseUrl}/admin\n- Host Admin B: hostb@test.local — start at ${baseUrl}/admin\n- Empty Host Admin: emptyhost@test.local — start at ${baseUrl}/admin\n\n## Representative states\n\n- Draft Event: Demo Draft Event\n- Published / check-in not started: Demo Full Event\n- Check-in open: Demo Weekly Flow — This Week\n- Check-in reopened: Demo Reopened Event\n- Attendance finalized: Demo Completed Event\n- Cancelled: Demo Cancelled Event\n- No upcoming Event: Empty Host Admin workspace\n\n## Routes\n\n- Public hub: ${baseUrl}/events\n- Open recurring event: ${baseUrl}/register/demo-recurring-${suffix}\n- Full: ${baseUrl}/register/demo-full-${suffix}\n- Paused: ${baseUrl}/register/demo-paused-${suffix}\n- Not yet open: ${baseUrl}/register/demo-not-yet-open-${suffix}\n- Closed: ${baseUrl}/register/demo-closed-${suffix}\n- Cancelled: ${baseUrl}/register/demo-cancelled-${suffix}\n- Unpublished: ${baseUrl}/register/demo-unpublished-${suffix}\n- No communication: ${baseUrl}/register/demo-no-communication-${suffix}\n- Confirmation: returned after a successful local registration\n- Organizations: ${baseUrl}/admin/organizations\n- Venues: ${baseUrl}/admin/venues\n- Events: ${baseUrl}/admin/events\n- Invitations: ${baseUrl}/admin/invitations\n- Participants: ${baseUrl}/admin/participants\n- Follow-ups: ${baseUrl}/admin/follow-ups\n\nDo not copy credentials into committed documents or use these accounts outside local development.\n`;
const canonicalCommunityRoutes = routesText.replace(
  `- Follow-ups: ${baseUrl}/admin/follow-ups`,
  `- Community queue: ${baseUrl}/admin/community\n- Community group view: ${baseUrl}/admin/community?mode=group`,
);
writeFileSync(`${root}/${routesPath}`, canonicalCommunityRoutes, { mode: 0o600 });

console.log(
  `Local synthetic demo reset complete.\nCredentials: ${root}/${credentialsPath}\nRoute index: ${root}/${routesPath}\nAdmin sign-in: ${baseUrl}/admin/sign-in\nRoles: System Admin, Organization A Host Admin, Organization B Host Admin, Empty Organization Host Admin, authenticated non-admin, inactive admin\nRun pnpm demo:reset again to replace the accounts. Never use these accounts outside local development.`,
);
