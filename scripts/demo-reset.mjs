import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const localOnly = process.env.APP_ENV !== "production";
if (!localOnly) throw new Error("Refusing to create synthetic demo data in production.");
rmSync(`${root}/.demo-credentials.local`, { force: true });
rmSync(`${root}/.demo-routes.local.md`, { force: true });

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

async function authUser(email, password) {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error(`Could not create ${email}`);
  return data.user.id;
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
delete from auth.users;
`);

const accounts = [
  [
    "systemAdmin",
    `demo-system-${suffix}@example.test`,
    "Demo System Administrator",
    "SYSTEM_ADMIN",
    "ACTIVE",
  ],
  [
    "hostAdminA",
    `demo-org-a-${suffix}@example.test`,
    "Demo Organization A Admin",
    "HOST_ADMIN",
    "ACTIVE",
  ],
  [
    "hostAdminB",
    `demo-org-b-${suffix}@example.test`,
    "Demo Organization B Admin",
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
  const password = `Demo-${randomBytes(18).toString("base64url")}!`;
  const authId = await authUser(email, password);
  authAccounts[key] = { id: authId, email, password, displayName, role, status };
}

const orgA = id();
const orgB = id();
const orgInactive = id();
const venueA = id();
const venueB = id();
const venueInactive = id();
const participantReturning = id();
const participantFirst = id();
const participantOtherOrg = id();
const ackParticipation = id();
const ackDataUse = id();
const ackWhatsApp = id();
const series = id();
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
  completed: id(),
};
const groupReturning = id();
const groupFirst = id();
const groupNoShow = id();
const regReturning = id();
const regFirst = id();
const regNoShow = id();
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
  `(${sql(eventId)}, ${sql(extras.org ?? orgA)}, ${sql(extras.venue ?? venueA)}, ${sql(name)}, ${sql(extras.description ?? "Synthetic pilot fixture for owner testing.")}, ${sql(iso(days))}, ${sql(iso(days, 19))}, 'America/New_York', ${extras.capacity ?? 20}, ${sql(iso(days, 17))}, ${sql(status)}, ${sql(extras.visibility ?? "PUBLIC")}, ${sql(extras.publication ?? (status === "OPEN" ? "PUBLISHED" : "UNPUBLISHED"))}, ${slug ? sql(slug) : "null"}, ${extras.communicationUrl ? sql(extras.communicationUrl) : "null"}, ${extras.communicationLabel ? sql(extras.communicationLabel) : "null"}, ${sql(authAccounts.systemAdmin.id)}, ${extras.eventSeries ? sql(extras.eventSeries) : "null"}, ${extras.occurrence ?? "null"})`;

const statement = `
insert into public.admin_profiles (id, display_name, email, role, status) values
${profileRows};
insert into public.organizations (id, name, organization_type, city, state, active_status) values
  (${sql(orgA)}, 'Demo Organization A', 'Community Center', 'Albany', 'NY', 'ACTIVE'),
  (${sql(orgB)}, 'Demo Organization B', 'Place of Worship', 'Buffalo', 'NY', 'ACTIVE'),
  (${sql(orgInactive)}, 'Demo Inactive Organization', 'Archived Partner', 'Rochester', 'NY', 'INACTIVE');
insert into public.admin_organization_assignments (admin_profile_id, organization_id, created_by_admin_id) values
  (${sql(authAccounts.hostAdminA.id)}, ${sql(orgA)}, ${sql(authAccounts.systemAdmin.id)}),
  (${sql(authAccounts.hostAdminB.id)}, ${sql(orgB)}, ${sql(authAccounts.systemAdmin.id)}),
  (${sql(authAccounts.inactiveAdmin.id)}, ${sql(orgA)}, ${sql(authAccounts.systemAdmin.id)});
insert into public.venues (id, organization_id, name, street, city, state, postal_code, timezone, active_status) values
  (${sql(venueA)}, ${sql(orgA)}, 'Demo Garden Studio', '1 Test Street', 'Albany', 'NY', '12207', 'America/New_York', 'ACTIVE'),
  (${sql(venueB)}, ${sql(orgB)}, 'Demo River Room', '2 Test Street', 'Buffalo', 'NY', '14201', 'America/New_York', 'ACTIVE'),
  (${sql(venueInactive)}, ${sql(orgInactive)}, 'Inactive Demo Venue', '3 Test Street', 'Rochester', 'NY', '14604', 'America/New_York', 'INACTIVE');
insert into public.acknowledgment_versions (id, type, version, exact_text, content_hash, effective_at, legal_status, created_by_admin_id) values
  (${sql(ackParticipation)}, 'PARTICIPATION_RISK', 9000, 'Synthetic participation acknowledgment for local testing only.', decode(repeat('aa', 32), 'hex'), now(), 'PROVISIONAL', ${sql(authAccounts.systemAdmin.id)}),
  (${sql(ackDataUse)}, 'DATA_USE', 9000, 'Synthetic data-use acknowledgment for local testing only.', decode(repeat('bb', 32), 'hex'), now(), 'APPROVED', ${sql(authAccounts.systemAdmin.id)}),
  (${sql(ackWhatsApp)}, 'WHATSAPP_DISCLOSURE', 9000, 'Synthetic WhatsApp disclosure for local testing only.', decode(repeat('cc', 32), 'hex'), now(), 'APPROVED', ${sql(authAccounts.systemAdmin.id)});
insert into public.event_series (id, frequency, interval_count, ends_on, selection_window_days, public_slug, created_by_admin_id)
values (${sql(series)}, 'WEEKLY', 1, ${sql(dateOnly(14))}, 14, ${sql(`demo-recurring-${suffix}`)}, ${sql(authAccounts.systemAdmin.id)});
insert into public.events (id, host_organization_id, venue_id, name, description, starts_at, ends_at, timezone, capacity, registration_deadline, status, visibility, publication_status, public_slug, communication_url, communication_label, created_by_admin_id, event_series_id, series_occurrence_number)
values
  ${event(recurringEvents[0], "Demo Weekly Flow — This Week", 2, "OPEN", null, { eventSeries: series, communicationUrl: "https://example.test/demo-group", communicationLabel: "Open the demo group" })},
  ${event(recurringEvents[1], "Demo Weekly Flow — Next Week", 9, "OPEN", null, { eventSeries: series })},
  ${event(recurringEvents[2], "Demo Weekly Flow — Final Date", 16, "OPEN", null, { eventSeries: series })},
  ${event(eventIds.full, "Demo Full Event", 4, "OPEN", `demo-full-${suffix}`, { capacity: 1 })},
  ${event(eventIds.paused, "Demo Paused Event", 5, "OPEN", `demo-paused-${suffix}`, { org: orgB, venue: venueB })},
  ${event(eventIds.notYetOpen, "Demo Not Yet Open", 6, "OPEN", `demo-not-yet-open-${suffix}`, { extras: null })},
  ${event(eventIds.closed, "Demo Closed Event", 7, "CLOSED", `demo-closed-${suffix}`)},
  ${event(eventIds.cancelled, "Demo Cancelled Event", 8, "CANCELLED", `demo-cancelled-${suffix}`, { org: orgB, venue: venueB })},
  ${event(eventIds.unpublished, "Demo Unpublished Event", 9, "OPEN", `demo-unpublished-${suffix}`, { publication: "UNPUBLISHED" })},
  ${event(eventIds.noCommunication, "Demo Event Without Communication Link", 10, "OPEN", `demo-no-communication-${suffix}`)},
  ${event(eventIds.completed, "Demo Completed Event", -3, "COMPLETED", null, { capacity: 20 })};
update public.events set event_series_id = ${sql(series)}, series_occurrence_number = 1 where id = ${sql(recurringEvents[0])};
update public.events set event_series_id = ${sql(series)}, series_occurrence_number = 2 where id = ${sql(recurringEvents[1])};
update public.events set event_series_id = ${sql(series)}, series_occurrence_number = 3 where id = ${sql(recurringEvents[2])};
update public.events set registration_opens_at = ${sql(iso(1))} where id = ${sql(eventIds.notYetOpen)};
update public.events set registration_paused_at = now() where id = ${sql(eventIds.paused)};
insert into public.participants (id, first_name, last_name, normalized_first_name, normalized_last_name, display_phone, normalized_phone, phone_country, email, primary_affiliation_organization_id)
values
  (${sql(participantReturning)}, 'Taylor', 'Returning', 'taylor', 'returning', '+15550001001', '+15550001001', 'US', 'taylor-${suffix}@example.test', ${sql(orgA)}),
  (${sql(participantFirst)}, 'Jordan', 'Firsttime', 'jordan', 'firsttime', '+15550001002', '+15550001002', 'US', 'jordan-${suffix}@example.test', ${sql(orgA)}),
  (${sql(participantOtherOrg)}, 'Casey', 'Crossvenue', 'casey', 'crossvenue', '+15550001003', '+15550001003', 'US', 'casey-${suffix}@example.test', ${sql(orgA)});
insert into public.registration_groups (id, participant_id, submission_source, participation_acknowledgment_version_id, participation_acknowledged_at, data_use_acknowledgment_version_id, data_use_acknowledged_at, created_by_admin_id)
values
  (${sql(groupReturning)}, ${sql(participantReturning)}, 'SYSTEM_ADMIN', ${sql(ackParticipation)}, now(), ${sql(ackDataUse)}, now(), ${sql(authAccounts.systemAdmin.id)}),
  (${sql(groupFirst)}, ${sql(participantFirst)}, 'SYSTEM_ADMIN', ${sql(ackParticipation)}, now(), ${sql(ackDataUse)}, now(), ${sql(authAccounts.systemAdmin.id)}),
  (${sql(groupNoShow)}, ${sql(participantOtherOrg)}, 'SYSTEM_ADMIN', ${sql(ackParticipation)}, now(), ${sql(ackDataUse)}, now(), ${sql(authAccounts.systemAdmin.id)});
insert into public.registrations (id, registration_group_id, participant_id, event_id, affiliation_organization_id_at_registration, registration_status, registration_outcome, created_by_admin_id, whatsapp_opt_in, whatsapp_opt_in_at, whatsapp_disclosure_version_id, whatsapp_invitation_status)
values
  (${sql(regReturning)}, ${sql(groupReturning)}, ${sql(participantReturning)}, ${sql(eventIds.open)}, ${sql(orgA)}, 'REGISTERED', 'ACTIVE', ${sql(authAccounts.systemAdmin.id)}, true, now(), ${sql(ackWhatsApp)}, 'PENDING'),
  (${sql(regFirst)}, ${sql(groupFirst)}, ${sql(participantFirst)}, ${sql(eventIds.full)}, ${sql(orgA)}, 'REGISTERED', 'ACTIVE', ${sql(authAccounts.systemAdmin.id)}, false, null, null, 'NOT_APPLICABLE'),
  (${sql(regNoShow)}, ${sql(groupNoShow)}, ${sql(participantOtherOrg)}, ${sql(eventIds.completed)}, ${sql(orgA)}, 'REGISTERED', 'ACTIVE', ${sql(authAccounts.systemAdmin.id)}, false, null, null, 'NOT_APPLICABLE');
update public.events set attendance_processing_state = 'FINALIZED' where id = ${sql(eventIds.completed)};
update public.events set attendance_processing_state = 'OPEN' where id = ${sql(eventIds.open)};
insert into public.attendance (id, registration_id, status, checked_in_at, finalized_at, updated_by_admin_id)
values (${sql(attendanceReturning)}, ${sql(regReturning)}, 'ATTENDED', now(), now(), ${sql(authAccounts.systemAdmin.id)}),
       (${sql(attendanceNoShow)}, ${sql(regNoShow)}, 'NO_SHOW', null, now(), ${sql(authAccounts.systemAdmin.id)});
update public.follow_up_tasks
set status = 'COMPLETED', completed_at = now(), completed_by_admin_id = ${sql(authAccounts.systemAdmin.id)}, completion_outcome = 'CONTACTED'
where trigger_key = ${sql(`no-show:${regNoShow}`)};
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
const credentialText = `# LOCAL-ONLY synthetic demo credentials\n# Replaced by every pnpm demo:reset. Never commit or use outside local development.\n\nAdmin sign-in: ${baseUrl}/admin/sign-in\nSystem Admin: ${authAccounts.systemAdmin.email}\nPassword: ${authAccounts.systemAdmin.password}\nOrganization A Host Admin: ${authAccounts.hostAdminA.email}\nPassword: ${authAccounts.hostAdminA.password}\nOrganization B Host Admin: ${authAccounts.hostAdminB.email}\nPassword: ${authAccounts.hostAdminB.password}\nAuthenticated non-admin: ${authAccounts.nonAdmin.email}\nPassword: ${authAccounts.nonAdmin.password}\nInactive admin: ${authAccounts.inactiveAdmin.email}\nPassword: ${authAccounts.inactiveAdmin.password}\n\nOpen event: ${baseUrl}/register/${`demo-recurring-${suffix}`}\nRecurring event hub: ${baseUrl}/register/${`demo-recurring-${suffix}`}\nFull event: ${baseUrl}/register/demo-full-${suffix}\nPaused event: ${baseUrl}/register/demo-paused-${suffix}\nNot-yet-open event: ${baseUrl}/register/demo-not-yet-open-${suffix}\nClosed event: ${baseUrl}/register/demo-closed-${suffix}\nNo-communication event: ${baseUrl}/register/demo-no-communication-${suffix}\nInvitations: ${baseUrl}/admin/invitations\n`;
writeFileSync(`${root}/${credentialsPath}`, credentialText, { mode: 0o600 });
const routesText = `# Local synthetic pilot route index\n\nGenerated by pnpm demo:reset; read alongside docs/37-pilot-manual-testing.md.\n\n- Public hub: ${baseUrl}/events\n- Open recurring event: ${baseUrl}/register/demo-recurring-${suffix}\n- Full: ${baseUrl}/register/demo-full-${suffix}\n- Paused: ${baseUrl}/register/demo-paused-${suffix}\n- Not yet open: ${baseUrl}/register/demo-not-yet-open-${suffix}\n- Closed: ${baseUrl}/register/demo-closed-${suffix}\n- Cancelled: ${baseUrl}/register/demo-cancelled-${suffix}\n- Unpublished: ${baseUrl}/register/demo-unpublished-${suffix}\n- No communication: ${baseUrl}/register/demo-no-communication-${suffix}\n- Confirmation: returned after a successful local registration\n- Admin sign-in: ${baseUrl}/admin/sign-in\n- System dashboard: ${baseUrl}/admin\n- Organizations: ${baseUrl}/admin/organizations\n- Venues: ${baseUrl}/admin/venues\n- Events: ${baseUrl}/admin/events\n- Invitations: ${baseUrl}/admin/invitations\n- Participants: ${baseUrl}/admin/participants\n- Follow-ups: ${baseUrl}/admin/follow-ups\n\nExpected roles: public routes are anonymous; admin routes require System Admin except event operations assigned to Host Admins.\n`;
writeFileSync(`${root}/${routesPath}`, routesText, { mode: 0o600 });

console.log(
  `Local synthetic demo reset complete.\nCredentials: ${root}/${credentialsPath}\nRoute index: ${root}/${routesPath}\nAdmin sign-in: ${baseUrl}/admin/sign-in\nRoles: System Admin, Organization A Host Admin, Organization B Host Admin, authenticated non-admin, inactive admin\nRun pnpm demo:reset again to replace the accounts. Never use these accounts outside local development.`,
);
