import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

test.setTimeout(90_000);

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
function sql(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}
function localSql(statement: string) {
  const container = execFileSync(
    "docker",
    ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
    { encoding: "utf8" },
  ).trim();
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
    { input: `begin;\n${statement}\ncommit;\n` },
  );
}
function localQuery(statement: string) {
  const container = execFileSync(
    "docker",
    ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
    { encoding: "utf8" },
  ).trim();
  return execFileSync(
    "docker",
    ["exec", container, "psql", "-At", "-U", "postgres", "-d", "postgres", "-c", statement],
    { encoding: "utf8" },
  ).trim();
}
async function signIn(page: Page, email: string, password: string) {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function createUser(supabase: SupabaseClient, prefix: string) {
  const suffix = randomUUID().slice(0, 8);
  const email = `${prefix}-${suffix}@example.test`;
  const password = `${randomBytes(24).toString("base64url")}Aa1!`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Could not create synthetic ${prefix}`);
  return { id: data.user.id, email, password };
}

function phase3FixtureSql(input: {
  systemId: string;
  hostId?: string;
  organizationA: string;
  organizationB: string;
  venueA: string;
  venueB: string;
  eventA: string;
  eventB: string;
  capacity?: number;
  activeRegistrations?: number;
  timezone?: string;
}) {
  const timezone = input.timezone ?? "America/New_York";
  const capacity = input.capacity ?? 20;
  const activeRegistrations = input.activeRegistrations ?? 0;
  const suffix = input.organizationA.slice(0, 8);
  const hostProfile = input.hostId
    ? `insert into public.admin_profiles (id, display_name, email, role, status) values (${sql(input.hostId)}, 'Synthetic Host Admin', 'synthetic-host-${input.hostId.slice(0, 8)}@example.test', 'HOST_ADMIN', 'ACTIVE');
       insert into public.admin_organization_assignments (admin_profile_id, organization_id, created_by_admin_id) values (${sql(input.hostId)}, ${sql(input.organizationA)}, ${sql(input.systemId)});`
    : "";
  const registrations = Array.from({ length: activeRegistrations }, (_, index) => {
    const participantId = randomUUID();
    const groupId = randomUUID();
    const registrationId = randomUUID();
    return `insert into public.participants (id, first_name, last_name, normalized_first_name, normalized_last_name, display_phone, normalized_phone, phone_country)
      values (${sql(participantId)}, 'Synthetic', 'Participant ${index + 1}', 'synthetic', 'participant${index + 1}', '+1555000${String(index + 1).padStart(4, "0")}', '+1555000${String(index + 1).padStart(4, "0")}', 'US');
      insert into public.registration_groups (id, participant_id, submission_source, participation_acknowledgment_version_id, participation_acknowledged_at, data_use_acknowledgment_version_id, data_use_acknowledged_at)
      values (${sql(groupId)}, ${sql(participantId)}, 'SYSTEM_ADMIN', (select id from public.acknowledgment_versions where type = 'PARTICIPATION_RISK' order by version desc limit 1), now(), (select id from public.acknowledgment_versions where type = 'DATA_USE' order by version desc limit 1), now());
      insert into public.registrations (id, registration_group_id, participant_id, event_id, registration_status, registration_outcome, created_by_admin_id)
      values (${sql(registrationId)}, ${sql(groupId)}, ${sql(participantId)}, ${sql(input.eventA)}, 'REGISTERED', 'ACTIVE', ${sql(input.systemId)});`;
  }).join("\n");
  return `
    insert into public.admin_profiles (id, display_name, email, role, status)
      values (${sql(input.systemId)}, 'Synthetic System Admin', 'synthetic-system-${input.systemId.slice(0, 8)}@example.test', 'SYSTEM_ADMIN', 'ACTIVE');
    insert into public.organizations (id, name, city, state) values
      (${sql(input.organizationA)}, 'Synthetic Organization A ${suffix}', 'Albany', 'NY'),
      (${sql(input.organizationB)}, 'Synthetic Organization B ${suffix}', 'Buffalo', 'NY');
    ${hostProfile}
    insert into public.venues (id, organization_id, name, street, city, state, postal_code, timezone) values
      (${sql(input.venueA)}, ${sql(input.organizationA)}, 'Synthetic Venue A ${suffix}', '1 Test Street', 'Albany', 'NY', '12207', ${sql(timezone)}),
      (${sql(input.venueB)}, ${sql(input.organizationB)}, 'Synthetic Venue B ${suffix}', '2 Test Street', 'Buffalo', 'NY', '14201', 'America/New_York');
    insert into public.events (id, host_organization_id, venue_id, name, starts_at, ends_at, timezone, capacity, registration_deadline, status, created_by_admin_id) values
      (${sql(input.eventA)}, ${sql(input.organizationA)}, ${sql(input.venueA)}, 'Synthetic Event A ${suffix}', '2099-06-15T14:00:00Z', '2099-06-15T15:00:00Z', ${sql(timezone)}, ${capacity}, '2099-06-15T13:00:00Z', 'DRAFT', ${sql(input.systemId)}),
      (${sql(input.eventB)}, ${sql(input.organizationB)}, ${sql(input.venueB)}, 'Synthetic Event B ${suffix}', '2099-06-16T14:00:00Z', '2099-06-16T15:00:00Z', 'America/New_York', 20, '2099-06-16T13:00:00Z', 'DRAFT', ${sql(input.systemId)});
    insert into public.acknowledgment_versions (type, version, exact_text, content_hash, effective_at, legal_status, created_by_admin_id) values
      ('PARTICIPATION_RISK', 9000, 'Synthetic participation acknowledgment', decode(repeat('aa', 32), 'hex'), now(), 'PROVISIONAL', ${sql(input.systemId)}),
      ('DATA_USE', 9000, 'Synthetic data-use acknowledgment', decode(repeat('bb', 32), 'hex'), now(), 'APPROVED', ${sql(input.systemId)})
      on conflict (type, version) do nothing;
    ${registrations}
  `;
}

test("System Admin completes the Phase 3 operational flow", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const suffix = randomUUID().slice(0, 8);
  const email = `phase3-system-${suffix}@example.test`;
  const password = `${randomBytes(24).toString("base64url")}Aa1!`;
  const organizationName = `Phase 3 Organization ${suffix}`;
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) throw new Error("Could not create synthetic System Admin");
  localSql(
    `insert into public.admin_profiles (id, display_name, email, role, status) values (${sql(authData.user.id)}, 'Phase 3 Browser Admin', ${sql(email)}, 'SYSTEM_ADMIN', 'ACTIVE');`,
  );

  await signIn(page, email, password);
  await page.getByRole("link", { name: "Organizations" }).click();
  await page.getByRole("link", { name: "Create" }).click();
  await page.getByLabel("Name").fill(organizationName);
  await page.getByRole("button", { name: "Create organization" }).click();
  await page.waitForTimeout(500);
  const organizationId = localQuery(
    `select id from public.organizations where name=${sql(organizationName)}`,
  );
  await page.goto(`/admin/organizations/${organizationId}`);
  await page.getByLabel("City").fill("Updated City");
  await page.getByRole("button", { name: "Save organization" }).click();
  await expect(page.getByText("Organization updated.")).toBeVisible();

  await page.goto("/admin/venues?mode=create");
  await page.getByLabel("Name").fill(`Phase 3 Venue ${suffix}`);
  await page.getByLabel("Organization").selectOption({ label: organizationName });
  await page.getByLabel("Street").fill("1 Test Street");
  await page.getByLabel("City").fill("Updated City");
  await page.getByLabel("State").fill("NY");
  await page.getByLabel("Postal code").fill("10001");
  await page.getByLabel("IANA timezone").fill("America/New_York");
  await page.getByRole("button", { name: "Create venue" }).click();
  const venueName = `Phase 3 Venue ${suffix}`;
  await expect(page.getByRole("link", { name: venueName })).toBeVisible();
  await page.getByRole("link", { name: venueName }).click();
  await page.locator('input[name="timezone"]').fill("America/Chicago");
  await page.getByRole("button", { name: "Save venue" }).click();

  await page.goto("/admin/events?mode=create");
  await page.getByLabel("Name").fill(`Phase 3 Event ${suffix}`);
  await page.getByLabel("Organization").selectOption({ label: organizationName });
  const venueId = localQuery(`select id from public.venues where name=${sql(venueName)}`);
  await page.getByLabel("Venue").selectOption({ value: venueId });
  await page.getByLabel("Capacity").fill("20");
  await page.getByLabel("Local start").fill("2099-06-15T10:00");
  await page.getByLabel("Local end").fill("2099-06-15T11:00");
  await page.getByLabel("Registration deadline").fill("2099-06-15T09:00");
  await page.getByRole("button", { name: "Create draft" }).click();
  const eventName = `Phase 3 Event ${suffix}`;
  await page.waitForTimeout(500);
  const createdEventId = localQuery(`select id from public.events where name=${sql(eventName)}`);
  await page.goto(`/admin/events/${createdEventId}`);
  await page.getByLabel("Description").fill("Updated operational description");
  await page.getByRole("button", { name: "Save event" }).click();
  await expect(page.getByText("Event updated.")).toBeVisible();
  await page.getByRole("button", { name: "Publish event" }).click();
  await page.waitForTimeout(2500);
  expect(localQuery(`select status from public.events where name=${sql(eventName)}`)).toBe("OPEN");
  await page.getByRole("button", { name: "Copy event" }).dispatchEvent("click");
  await page.waitForTimeout(1500);
  const copyId = localQuery(
    `select id from public.events where name=${sql(`${eventName} (Copy)`)}`,
  );
  expect(localQuery(`select status from public.events where id=${sql(copyId)}`)).toBe("DRAFT");
  const eventId = localQuery(`select id from public.events where name=${sql(eventName)}`);
  await page.goto(`/admin/events/${eventId}?refresh=${Date.now()}`);
  await page.getByRole("button", { name: "Cancel event" }).click();
  await page.waitForTimeout(1000);
  expect(localQuery(`select status from public.events where name=${sql(eventName)}`)).toBe(
    "CANCELLED",
  );
  await page.goto(`/admin/events/${eventId}?refresh=${Date.now()}`);
  await expect(page.getByText(/permanently cancelled and cannot be restored/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel event" })).toHaveCount(0);
});

test("Host Admin is denied organization management and scoped to assigned venue management", async ({
  page,
}) => {
  const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const system = await createUser(supabase, "phase3-scope-system");
  const host = await createUser(supabase, "phase3-scope-host");
  const organizationA = randomUUID();
  const organizationB = randomUUID();
  const venueA = randomUUID();
  const venueB = randomUUID();
  const eventA = randomUUID();
  const eventB = randomUUID();
  const suffix = organizationA.slice(0, 8);
  localSql(
    phase3FixtureSql({
      systemId: system.id,
      hostId: host.id,
      organizationA,
      organizationB,
      venueA,
      venueB,
      eventA,
      eventB,
    }),
  );

  await signIn(page, host.email, host.password);
  await page.goto("/admin/organizations");
  await expect(page.getByText(/access denied/i)).toBeVisible();
  await page.goto(`/admin/organizations/${organizationA}`);
  await expect(page.getByText(/access denied/i)).toBeVisible();

  await page.goto("/admin/venues");
  await expect(page.getByText(`Synthetic Venue A ${suffix}`)).toBeVisible();
  await expect(page.getByText(`Synthetic Venue B ${suffix}`)).toHaveCount(0);
  await page.goto(`/admin/venues/${venueA}`);
  await expect(page.getByRole("heading", { name: `Synthetic Venue A ${suffix}` })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save venue" })).toBeVisible();
  await page.getByLabel("City").fill("Assigned Host City");
  await page.getByRole("button", { name: "Save venue" }).click();
  await page.waitForTimeout(500);
  expect(localQuery(`select city from public.venues where id=${sql(venueA)}`)).toBe(
    "Assigned Host City",
  );

  for (const path of [
    `/admin/organizations/${organizationB}`,
    `/admin/venues/${venueB}`,
    `/admin/events/${eventB}`,
  ]) {
    await page.goto(path);
    await expect(page.getByText(/access denied|not found/i).first()).toBeVisible();
    expect(await page.content()).not.toContain(`Synthetic Organization B ${suffix}`);
    expect(await page.content()).not.toContain(`Synthetic Venue B ${suffix}`);
    expect(await page.content()).not.toContain(`Synthetic Event B ${suffix}`);
  }

  const hostClient = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  const { error: signInError } = await hostClient.auth.signInWithPassword({
    email: host.email,
    password: host.password,
  });
  expect(signInError).toBeNull();
  const { error: mutationError } = await hostClient
    .from("organizations")
    .update({ name: "Tampered Organization" })
    .eq("id", organizationB)
    .select("id")
    .single();
  expect(mutationError).toBeTruthy();
  expect(localQuery(`select name from public.organizations where id=${sql(organizationB)}`)).toBe(
    `Synthetic Organization B ${suffix}`,
  );
  const { error: venueMutationError } = await hostClient
    .from("venues")
    .update({ name: "Tampered Venue" })
    .eq("id", venueB)
    .select("id")
    .single();
  expect(venueMutationError).toBeTruthy();
  expect(localQuery(`select name from public.venues where id=${sql(venueB)}`)).toBe(
    `Synthetic Venue B ${suffix}`,
  );
});

test("System Admin capacity floor accepts equal counts and rejects lower capacity", async ({
  page,
}) => {
  const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const system = await createUser(supabase, "phase3-capacity-system");
  const organizationA = randomUUID();
  const organizationB = randomUUID();
  const venueA = randomUUID();
  const venueB = randomUUID();
  const eventA = randomUUID();
  const eventB = randomUUID();
  localSql(
    phase3FixtureSql({
      systemId: system.id,
      organizationA,
      organizationB,
      venueA,
      venueB,
      eventA,
      eventB,
      capacity: 3,
      activeRegistrations: 3,
    }),
  );
  await signIn(page, system.email, system.password);
  await page.goto(`/admin/events/${eventA}`);
  await page.getByLabel("Capacity").fill("4");
  await page.getByRole("button", { name: "Save event" }).click();
  await expect(page.getByText("Event updated.")).toBeVisible();
  await page.getByLabel("Capacity").fill("3");
  await page.getByRole("button", { name: "Save event" }).click();
  await expect(page.getByText("Event updated.")).toBeVisible();
  await page.getByLabel("Capacity").fill("2");
  await page.getByRole("button", { name: "Save event" }).click();
  await expect(page.getByText(/event could not be updated|capacity/i)).toBeVisible();
  expect(localQuery(`select capacity from public.events where id=${sql(eventA)}`)).toBe("3");
  const directCapacityError = await supabase
    .from("events")
    .update({ capacity: 2 })
    .eq("id", eventA);
  expect(directCapacityError.error).toBeTruthy();
  expect(localQuery(`select capacity from public.events where id=${sql(eventA)}`)).toBe("3");
});

test("System Admin venue timezone edit persists without rescheduling event UTC instants", async ({
  page,
}) => {
  const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const system = await createUser(supabase, "phase3-timezone-system");
  const organizationA = randomUUID();
  const organizationB = randomUUID();
  const venueA = randomUUID();
  const venueB = randomUUID();
  const eventA = randomUUID();
  const eventB = randomUUID();
  localSql(
    phase3FixtureSql({
      systemId: system.id,
      organizationA,
      organizationB,
      venueA,
      venueB,
      eventA,
      eventB,
      timezone: "America/New_York",
    }),
  );
  const before = localQuery(
    `select timezone || '|' || starts_at::text || '|' || ends_at::text from public.events where id=${sql(eventA)}`,
  );
  await signIn(page, system.email, system.password);
  await page.goto(`/admin/venues/${venueA}`);
  await page.getByLabel("IANA timezone").fill("America/Chicago");
  await page.getByRole("button", { name: "Save venue" }).click();
  await page.waitForTimeout(500);
  expect(localQuery(`select timezone from public.venues where id=${sql(venueA)}`)).toBe(
    "America/Chicago",
  );
  await page.reload();
  await expect(page.getByText(/America\/Chicago/)).toBeVisible();
  const after = localQuery(
    `select timezone || '|' || starts_at::text || '|' || ends_at::text from public.events where id=${sql(eventA)}`,
  );
  expect(after).toBe(before);
  expect(
    localQuery(
      `select count(*)::text from public.audit_events where entity_type = 'VENUE' and entity_id=${sql(venueA)} and action = 'VENUE_UPDATED'`,
    ),
  ).toBe("1");
  await page.getByLabel("IANA timezone").fill("Not/A_Timezone");
  await page.getByRole("button", { name: "Save venue" }).click();
  await expect(page.getByText(/valid IANA timezone/i)).toBeVisible();
  expect(localQuery(`select timezone from public.venues where id=${sql(venueA)}`)).toBe(
    "America/Chicago",
  );
});
