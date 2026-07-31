import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const iso = (days, hour = 14) => {
  const date = new Date(Date.now() + days * 86400000);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
};
const dateOnly = (days) => iso(days).slice(0, 10);

execFileSync("supabase", ["stop", "--no-backup"], { cwd: root, stdio: "ignore" });
execFileSync("supabase", ["start"], { cwd: root, stdio: "ignore" });
const status = execFileSync("supabase", ["status", "-o", "env"], { cwd: root, encoding: "utf8" });
const values = Object.fromEntries(
  [...status.matchAll(/^([A-Z0-9_]+)="(.*)"$/gm)].map((match) => [match[1], match[2]]),
);
const service = createClient(values.API_URL, values.SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function authUser(email, password) {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error(`Could not create ${email}`);
  return data.user.id;
}

const suffix = randomBytes(3).toString("hex");
const systemEmail = `demo-system-${suffix}@example.test`;
const orgAEmail = `demo-org-a-${suffix}@example.test`;
const orgBEmail = `demo-org-b-${suffix}@example.test`;
const nonAdminEmail = `demo-non-admin-${suffix}@example.test`;
const password = `Demo-${randomBytes(12).toString("base64url")}!`;
const systemId = await authUser(systemEmail, password);
const orgAId = await authUser(orgAEmail, password);
const orgBId = await authUser(orgBEmail, password);
const nonAdminId = await authUser(nonAdminEmail, password);
const inactiveId = await authUser(`inactive-${suffix}@example.test`, password);
const organizationA = randomUUID();
const organizationB = randomUUID();
const venueA = randomUUID();
const venueB = randomUUID();
const openEvent = randomUUID();
const fullEvent = randomUUID();
const pausedEvent = randomUUID();
const futureEvent = randomUUID();
const cancelledEvent = randomUUID();
const slug = `demo-open-${suffix}`;
const participant = randomUUID();
const group = randomUUID();
const registration = randomUUID();
const attended = randomUUID();
const noShowGroup = randomUUID();
const noShowRegistration = randomUUID();
const invitedEmail = `demo-pending-${suffix}@example.test`;
const invitedHash = randomBytes(32).toString("hex");
const expiredHash = randomBytes(32).toString("hex");
const revokedHash = randomBytes(32).toString("hex");

const container = execFileSync(
  "docker",
  ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
  { encoding: "utf8" },
).trim();
const statement = `
insert into public.admin_profiles (id, display_name, email, role, status) values
  (${sql(systemId)}, 'Demo System Administrator', ${sql(systemEmail)}, 'SYSTEM_ADMIN', 'ACTIVE'),
  (${sql(orgAId)}, 'Demo Organization A Admin', ${sql(orgAEmail)}, 'HOST_ADMIN', 'ACTIVE'),
  (${sql(orgBId)}, 'Demo Organization B Admin', ${sql(orgBEmail)}, 'HOST_ADMIN', 'ACTIVE'),
  (${sql(inactiveId)}, 'Inactive Demo Admin', 'inactive-${suffix}@example.test', 'HOST_ADMIN', 'DEACTIVATED');
insert into public.organizations (id, name, city, state) values
  (${sql(organizationA)}, 'Demo Organization A', 'Albany', 'NY'),
  (${sql(organizationB)}, 'Demo Organization B', 'Buffalo', 'NY');
insert into public.admin_organization_assignments (admin_profile_id, organization_id, created_by_admin_id) values
  (${sql(orgAId)}, ${sql(organizationA)}, ${sql(systemId)}),
  (${sql(orgBId)}, ${sql(organizationB)}, ${sql(systemId)});
insert into public.venues (id, organization_id, name, street, city, state, postal_code, timezone) values
  (${sql(venueA)}, ${sql(organizationA)}, 'Demo Garden Studio', '1 Test Street', 'Albany', 'NY', '12207', 'America/New_York'),
  (${sql(venueB)}, ${sql(organizationB)}, 'Demo River Room', '2 Test Street', 'Buffalo', 'NY', '14201', 'America/New_York');
insert into public.events (id, host_organization_id, venue_id, name, description, starts_at, ends_at, timezone, capacity, registration_deadline, status, visibility, publication_status, public_slug, communication_url, communication_label, created_by_admin_id) values
  (${sql(openEvent)}, ${sql(organizationA)}, ${sql(venueA)}, 'Demo Community Flow', 'A welcoming synthetic event.', ${sql(iso(5))}, ${sql(iso(5, 15))}, 'America/New_York', 20, ${sql(iso(5, 13))}, 'OPEN', 'PUBLIC', 'PUBLISHED', ${sql(slug)}, 'https://example.test/demo-group', 'Open the demo group', ${sql(systemId)}),
  (${sql(fullEvent)}, ${sql(organizationA)}, ${sql(venueA)}, 'Demo Full Event', null, ${sql(iso(7))}, ${sql(iso(7, 15))}, 'America/New_York', 1, ${sql(iso(7, 13))}, 'OPEN', 'PUBLIC', 'PUBLISHED', ${sql(`demo-full-${suffix}`)}, null, null, ${sql(systemId)}),
  (${sql(pausedEvent)}, ${sql(organizationB)}, ${sql(venueB)}, 'Demo Paused Event', null, ${sql(iso(9))}, ${sql(iso(9, 15))}, 'America/New_York', 20, ${sql(iso(9, 13))}, 'OPEN', 'PUBLIC', 'PUBLISHED', ${sql(`demo-paused-${suffix}`)}, null, null, ${sql(systemId)}),
  (${sql(futureEvent)}, ${sql(organizationA)}, ${sql(venueA)}, 'Demo Not Yet Open', null, ${sql(iso(12))}, ${sql(iso(12, 15))}, 'America/New_York', 20, ${sql(iso(12, 13))}, 'OPEN', 'PUBLIC', 'PUBLISHED', ${sql(`demo-future-${suffix}`)}, null, null, ${sql(systemId)}),
  (${sql(cancelledEvent)}, ${sql(organizationB)}, ${sql(venueB)}, 'Demo Cancelled Event', null, ${sql(iso(14))}, ${sql(iso(14, 15))}, 'America/New_York', 20, ${sql(iso(14, 13))}, 'CANCELLED', 'PUBLIC', 'UNPUBLISHED', null, null, null, ${sql(systemId)});
update public.events set registration_paused_at = now() where id = ${sql(pausedEvent)};
insert into public.acknowledgment_versions (type, version, exact_text, content_hash, effective_at, legal_status, created_by_admin_id) values
  ('PARTICIPATION_RISK', 9000, 'Synthetic participation acknowledgment', decode(repeat('aa', 32), 'hex'), now(), 'PROVISIONAL', ${sql(systemId)}),
  ('DATA_USE', 9000, 'Synthetic data-use acknowledgment', decode(repeat('bb', 32), 'hex'), now(), 'APPROVED', ${sql(systemId)})
  on conflict (type, version) do nothing;
insert into public.participants (id, first_name, last_name, normalized_first_name, normalized_last_name, display_phone, normalized_phone, phone_country, email)
values (${sql(participant)}, 'Demo', 'Participant', 'demo', 'participant', '+15550001000', '+15550001000', 'US', 'participant-${suffix}@example.test');
insert into public.registration_groups (id, participant_id, submission_source, participation_acknowledgment_version_id, participation_acknowledged_at, data_use_acknowledgment_version_id, data_use_acknowledged_at, created_by_admin_id)
values (${sql(group)}, ${sql(participant)}, 'SYSTEM_ADMIN', (select id from public.acknowledgment_versions where type='PARTICIPATION_RISK' order by version desc limit 1), now(), (select id from public.acknowledgment_versions where type='DATA_USE' order by version desc limit 1), now(), ${sql(systemId)});
insert into public.registrations (id, registration_group_id, participant_id, event_id, registration_status, registration_outcome, created_by_admin_id)
values (${sql(registration)}, ${sql(group)}, ${sql(participant)}, ${sql(openEvent)}, 'REGISTERED', 'ACTIVE', ${sql(systemId)});
insert into public.registrations (id, registration_group_id, participant_id, event_id, registration_status, registration_outcome, created_by_admin_id)
values (${sql(attended)}, ${sql(group)}, ${sql(participant)}, ${sql(fullEvent)}, 'REGISTERED', 'ACTIVE', ${sql(systemId)});
update public.events set attendance_processing_state = 'FINALIZED' where id = ${sql(fullEvent)};
insert into public.attendance (registration_id, status, checked_in_at, finalized_at, updated_by_admin_id)
values (${sql(attended)}, 'ATTENDED', now(), now(), ${sql(systemId)});
insert into public.registration_groups (id, participant_id, submission_source, participation_acknowledgment_version_id, participation_acknowledged_at, data_use_acknowledgment_version_id, data_use_acknowledged_at, created_by_admin_id)
values (${sql(noShowGroup)}, ${sql(participant)}, 'SYSTEM_ADMIN', (select id from public.acknowledgment_versions where type='PARTICIPATION_RISK' order by version desc limit 1), now(), (select id from public.acknowledgment_versions where type='DATA_USE' order by version desc limit 1), now(), ${sql(systemId)});
insert into public.registrations (id, registration_group_id, participant_id, event_id, registration_status, registration_outcome, created_by_admin_id)
values (${sql(noShowRegistration)}, ${sql(noShowGroup)}, ${sql(participant)}, ${sql(cancelledEvent)}, 'CANCELLED', 'EVENT_CANCELLED', ${sql(systemId)});
insert into public.admin_invitations (invited_email, role, status, token_hash, token_expires_at, invited_by_admin_id)
values (${sql(invitedEmail)}, 'HOST_ADMIN', 'PENDING', decode(${sql(invitedHash)}, 'hex'), now() + interval '3 days', ${sql(systemId)}),
  ('expired-${suffix}@example.test', 'HOST_ADMIN', 'EXPIRED', decode(${sql(expiredHash)}, 'hex'), now() - interval '1 day', ${sql(systemId)}),
  ('revoked-${suffix}@example.test', 'HOST_ADMIN', 'REVOKED', decode(${sql(revokedHash)}, 'hex'), now() + interval '3 days', ${sql(systemId)});
insert into public.follow_up_tasks (participant_id, event_id, reason, trigger_key, due_at, status, suggested_message, completed_at, completed_by_admin_id)
values (${sql(participant)}, ${sql(fullEvent)}, 'NO_SHOW', ${sql(`no-show:${attended}`)}, now() - interval '1 day', 'COMPLETED', 'We missed you at the event.', now(), ${sql(systemId)});
`;
execFileSync(
  "docker",
  ["exec", "-i", container, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
  { input: `begin;\n${statement}\ncommit;\n` },
);

console.log(
  JSON.stringify(
    {
      systemAdmin: { email: systemEmail, password },
      hostAdminA: { email: orgAEmail, password },
      hostAdminB: { email: orgBEmail, password },
      nonAdmin: { email: nonAdminEmail, password },
      publicEventUrl: `http://127.0.0.1:3000/register/${slug}`,
      note: "Synthetic local credentials only. Do not commit or use in hosted environments.",
    },
    null,
    2,
  ),
);
