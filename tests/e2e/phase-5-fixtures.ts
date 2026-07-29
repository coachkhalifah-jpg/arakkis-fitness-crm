import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Identity = {
  id: string;
  email: string;
  password: string;
};

export type Phase5Fixture = {
  system: Identity;
  hostA: Identity;
  hostB: Identity;
  nonAdmin: Identity;
  inactive: Identity;
  organizationA: string;
  organizationB: string;
  venueA: string;
  venueB: string;
  participationAck: string;
  dataUseAck: string;
  suffix: string;
};

export type AttendanceEvent = {
  id: string;
  name: string;
};

function env(name: string) {
  const value = process.env[name];
  if (!value)
    throw new Error(
      `Missing ${name}; start local Supabase and provide test environment variables.`,
    );
  return value;
}

function sql(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function localContainer() {
  const container = execFileSync(
    "docker",
    ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
    { encoding: "utf8" },
  ).trim();
  if (!container) throw new Error("Local Supabase database container is not running");
  return container;
}

export function localSql(statement: string) {
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      localContainer(),
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

export function localQuery(statement: string) {
  const normalizedStatement = statement.replaceAll(/"([^"]*)"/g, "'$1'");
  return execFileSync(
    "docker",
    [
      "exec",
      localContainer(),
      "psql",
      "-At",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-c",
      normalizedStatement,
    ],
    { encoding: "utf8" },
  ).trim();
}

function password() {
  return `${randomBytes(24).toString("base64url")}Aa1!`;
}

async function createAuthUser(client: SupabaseClient, prefix: string): Promise<Identity> {
  const suffix = randomUUID().slice(0, 8);
  const email = `phase5-${prefix}-${suffix}@example.test`;
  const value = password();
  const { data, error } = await client.auth.admin.createUser({
    email,
    password: value,
    email_confirm: true,
  });
  if (error || !data.user)
    throw new Error(
      `Could not create synthetic ${prefix} identity: ${error?.message ?? "missing user"}`,
    );
  return { id: data.user.id, email, password: value };
}

export async function createPhase5Fixture(): Promise<Phase5Fixture> {
  const service = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const suffix = randomUUID().slice(0, 8);
  const [system, hostA, hostB, nonAdmin, inactive] = await Promise.all([
    createAuthUser(service, "system"),
    createAuthUser(service, "host-a"),
    createAuthUser(service, "host-b"),
    createAuthUser(service, "user"),
    createAuthUser(service, "inactive"),
  ]);
  const organizationA = randomUUID();
  const organizationB = randomUUID();
  const venueA = randomUUID();
  const venueB = randomUUID();
  const participationAck = randomUUID();
  const dataUseAck = randomUUID();
  const version = 50000 + Math.floor(Math.random() * 10000);

  localSql(`
    insert into public.organizations (id, name) values
      (${sql(organizationA)}, ${sql(`Phase 5 Organization A ${suffix}`)}),
      (${sql(organizationB)}, ${sql(`Phase 5 Organization B ${suffix}`)});
    insert into public.admin_profiles (id, display_name, email, role, status) values
      (${sql(system.id)}, 'Phase 5 System Admin', ${sql(system.email)}, 'SYSTEM_ADMIN', 'ACTIVE'),
      (${sql(hostA.id)}, 'Phase 5 Host Admin A', ${sql(hostA.email)}, 'HOST_ADMIN', 'ACTIVE'),
      (${sql(hostB.id)}, 'Phase 5 Host Admin B', ${sql(hostB.email)}, 'HOST_ADMIN', 'ACTIVE'),
      (${sql(inactive.id)}, 'Phase 5 Inactive Admin', ${sql(inactive.email)}, 'HOST_ADMIN', 'SUSPENDED');
    insert into public.admin_organization_assignments (admin_profile_id, organization_id, created_by_admin_id) values
      (${sql(hostA.id)}, ${sql(organizationA)}, ${sql(system.id)}),
      (${sql(hostB.id)}, ${sql(organizationB)}, ${sql(system.id)});
    insert into public.venues (id, organization_id, name, street, city, state, postal_code, timezone) values
      (${sql(venueA)}, ${sql(organizationA)}, 'Phase 5 Venue A', '1 Test Street', 'Albany', 'NY', '12207', 'America/New_York'),
      (${sql(venueB)}, ${sql(organizationB)}, 'Phase 5 Venue B', '2 Test Street', 'Buffalo', 'NY', '14201', 'America/New_York');
    insert into public.acknowledgment_versions (id, type, version, exact_text, content_hash, effective_at, legal_status, created_by_admin_id) values
      (${sql(participationAck)}, 'PARTICIPATION_RISK', ${version}, 'Synthetic participation acknowledgment.', decode(repeat('a', 64), 'hex'), now(), 'PROVISIONAL', ${sql(system.id)}),
      (${sql(dataUseAck)}, 'DATA_USE', ${version}, 'Synthetic data-use acknowledgment.', decode(repeat('b', 64), 'hex'), now(), 'APPROVED', ${sql(system.id)});
  `);
  return {
    system,
    hostA,
    hostB,
    nonAdmin,
    inactive,
    organizationA,
    organizationB,
    venueA,
    venueB,
    participationAck,
    dataUseAck,
    suffix,
  };
}

export function adminClient() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function signedInClient(identity: Identity) {
  const client = adminClient();
  const { error } = await client.auth.signInWithPassword({
    email: identity.email,
    password: identity.password,
  });
  if (error) throw new Error(`Could not sign in synthetic ${identity.email}: ${error.message}`);
  return client;
}

export async function signInPage(
  page: {
    goto: (url: string) => Promise<unknown>;
    getByLabel: (label: string) => { fill: (value: string) => Promise<unknown> };
    getByRole: (role: "button", options: { name: string }) => { click: () => Promise<unknown> };
  },
  identity: Identity,
  next = "/admin",
) {
  await page.goto(`/admin/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(identity.email);
  await page.getByLabel("Password").fill(identity.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export function createEvent(
  fixture: Phase5Fixture,
  options: {
    organizationId?: string;
    capacity?: number;
    state?: string;
    status?: string;
    name?: string;
  } = {},
): AttendanceEvent {
  const id = randomUUID();
  const name = options.name ?? `Phase 5 Attendance ${fixture.suffix}-${id.slice(0, 6)}`;
  const organizationId = options.organizationId ?? fixture.organizationA;
  const venueId = organizationId === fixture.organizationB ? fixture.venueB : fixture.venueA;
  localSql(`
    insert into public.events (id, host_organization_id, venue_id, name, description, participant_instructions, starts_at, ends_at, timezone, capacity, registration_deadline, status, visibility, attendance_processing_state, created_by_admin_id)
    values (${sql(id)}, ${sql(organizationId)}, ${sql(venueId)}, ${sql(name)}, 'Synthetic event.', 'Synthetic instructions.', '2099-12-01T14:00:00Z', '2099-12-01T15:00:00Z', 'America/New_York', ${options.capacity ?? 10}, '2099-12-01T13:00:00Z', ${sql(options.status ?? "OPEN")}, 'PUBLIC', ${sql(options.state ?? "NOT_STARTED")}, ${sql(fixture.system.id)});
  `);
  return { id, name };
}

export function createRegisteredParticipant(
  fixture: Phase5Fixture,
  eventId: string,
  options: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    status?: string;
    outcome?: string;
  } = {},
) {
  const participantId = randomUUID();
  const groupId = randomUUID();
  const registrationId = randomUUID();
  const firstName = options.firstName ?? `Participant ${participantId.slice(0, 6)}`;
  const lastName = options.lastName ?? fixture.suffix;
  const phone = options.phone ?? `+1518555${Math.floor(1000 + Math.random() * 8999)}`;
  const email = options.email ?? null;
  localSql(`
    insert into public.participants (id, first_name, last_name, normalized_first_name, normalized_last_name, display_phone, normalized_phone, phone_country, email, normalized_email)
    values (${sql(participantId)}, ${sql(firstName)}, ${sql(lastName)}, ${sql(firstName.toLowerCase())}, ${sql(lastName.toLowerCase())}, ${sql(phone)}, ${sql(phone)}, 'US', ${email ? sql(email) : "null"}, ${email ? sql(email.toLowerCase()) : "null"});
    insert into public.registration_groups (id, participant_id, submission_source, participation_acknowledgment_version_id, participation_acknowledged_at, data_use_acknowledgment_version_id, data_use_acknowledged_at)
    values (${sql(groupId)}, ${sql(participantId)}, 'PUBLIC', ${sql(fixture.participationAck)}, now(), ${sql(fixture.dataUseAck)}, now());
    insert into public.registrations (id, registration_group_id, participant_id, event_id, registration_status, registration_outcome)
    values (${sql(registrationId)}, ${sql(groupId)}, ${sql(participantId)}, ${sql(eventId)}, ${sql(options.status ?? "REGISTERED")}, ${sql(options.outcome ?? "ACTIVE")});
  `);
  return { participantId, groupId, registrationId, firstName, lastName, phone };
}

export async function openAttendance(client: SupabaseClient, eventId: string) {
  const result = await client.rpc("phase5_open_attendance", { p_event_id: eventId });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export function walkInArgs(
  fixture: Phase5Fixture,
  eventId: string,
  firstName: string,
  lastName: string,
  phone: string,
  overrideReason: string | null = null,
  email = `${firstName.toLowerCase().replaceAll(" ", ".")}@example.test`,
) {
  return {
    p_event_id: eventId,
    p_first_name: firstName,
    p_last_name: lastName,
    p_display_phone: phone,
    p_normalized_phone: phone,
    p_phone_country: "US",
    p_email: email,
    p_normalized_email: email,
    p_affiliation_organization_id: null,
    p_affiliation_other_text: null,
    p_participation_acknowledgment_version_id: fixture.participationAck,
    p_data_use_acknowledgment_version_id: fixture.dataUseAck,
    p_ip_address: "127.0.0.1",
    p_user_agent: "phase-5-fixture",
    p_over_capacity_reason: overrideReason,
  } as never;
}
