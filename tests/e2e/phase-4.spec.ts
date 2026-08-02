import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test.describe.configure({ mode: "serial" });

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
  if (!container) throw new Error("Local Supabase database container is not running");
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

async function createAuthUser(email: string, password: string) {
  const client = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error("Could not create synthetic browser identity");
  return data.user.id;
}

type Fixture = {
  systemId: string;
  hostEmail: string;
  hostPassword: string;
  eventA: string;
  eventB: string;
  eventNameA: string;
  eventNameB: string;
  organizationName: string;
  matchFirstName: string;
  matchLastName: string;
  organizationId: string;
  venueId: string;
  participationAckId: string;
  dataUseAckId: string;
};
let fixture: Fixture;

test.beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  const systemEmail = `phase4-system-${suffix}@example.test`;
  const hostEmail = `phase4-host-${suffix}@example.test`;
  const hostPassword = `${randomBytes(24).toString("base64url")}Aa1!`;
  const systemId = await createAuthUser(
    systemEmail,
    `${randomBytes(24).toString("base64url")}Aa1!`,
  );
  const hostId = await createAuthUser(hostEmail, hostPassword);
  const organizationId = randomUUID();
  const organizationB = randomUUID();
  const venueId = randomUUID();
  const venueB = randomUUID();
  const eventA = randomUUID();
  const eventB = randomUUID();
  const fullEvent = randomUUID();
  const draftEvent = randomUUID();
  const organizationName = `Phase 4 Organization ${suffix}`;
  const eventNameA = `Phase 4 Strength ${suffix}`;
  const eventNameB = `Phase 4 Mobility ${suffix}`;
  const participationAckId = randomUUID();
  const dataUseAckId = randomUUID();
  const acknowledgmentVersion = 9400 + Math.floor(Math.random() * 500);
  const matchFirstName = `Existing ${suffix}`;
  const matchLastName = `Participant ${suffix}`;
  localSql(`
    insert into public.admin_profiles (id, display_name, email, role, status) values
      (${sql(systemId)}, 'Phase 4 System Admin', ${sql(systemEmail)}, 'SYSTEM_ADMIN', 'ACTIVE'),
      (${sql(hostId)}, 'Phase 4 Host Admin', ${sql(hostEmail)}, 'HOST_ADMIN', 'ACTIVE');
    insert into public.organizations (id, name) values
      (${sql(organizationId)}, ${sql(organizationName)}),
      (${sql(organizationB)}, ${sql(`Phase 4 Unassigned ${suffix}`)});
    insert into public.admin_organization_assignments (admin_profile_id, organization_id, created_by_admin_id)
      values (${sql(hostId)}, ${sql(organizationId)}, ${sql(systemId)});
    insert into public.venues (id, organization_id, name, street, city, state, postal_code, timezone) values
      (${sql(venueId)}, ${sql(organizationId)}, 'Phase 4 Venue', '1 Test Street', 'Albany', 'NY', '12207', 'America/New_York'),
      (${sql(venueB)}, ${sql(organizationB)}, 'Phase 4 Other Venue', '2 Test Street', 'Buffalo', 'NY', '14201', 'America/New_York');
    insert into public.acknowledgment_versions (id, type, version, exact_text, content_hash, effective_at, legal_status, created_by_admin_id) values
      (${sql(participationAckId)}, 'PARTICIPATION_RISK', ${acknowledgmentVersion}, 'Synthetic participation acknowledgment.', decode(repeat('a', 64), 'hex'), now(), 'PROVISIONAL', ${sql(systemId)}),
      (${sql(dataUseAckId)}, 'DATA_USE', ${acknowledgmentVersion}, 'Synthetic data-use acknowledgment.', decode(repeat('b', 64), 'hex'), now(), 'APPROVED', ${sql(systemId)});
    insert into public.events (id, host_organization_id, venue_id, name, description, participant_instructions, starts_at, ends_at, timezone, capacity, registration_deadline, status, visibility, created_by_admin_id) values
      (${sql(eventA)}, ${sql(organizationId)}, ${sql(venueId)}, ${sql(eventNameA)}, 'Bring a mat.', 'Arrive early.', '2099-08-01T14:00:00Z', '2099-08-01T15:00:00Z', 'America/New_York', 20, '2099-08-01T13:00:00Z', 'OPEN', 'PUBLIC', ${sql(systemId)}),
      (${sql(eventB)}, ${sql(organizationId)}, ${sql(venueId)}, ${sql(eventNameB)}, 'Bring water.', 'Arrive early.', '2099-08-08T14:00:00Z', '2099-08-08T15:00:00Z', 'America/New_York', 20, '2099-08-08T13:00:00Z', 'OPEN', 'PUBLIC', ${sql(systemId)}),
      (${sql(fullEvent)}, ${sql(organizationId)}, ${sql(venueId)}, 'Phase 4 Full ${suffix}', null, null, '2099-08-15T14:00:00Z', '2099-08-15T15:00:00Z', 'America/New_York', 1, '2099-08-15T13:00:00Z', 'OPEN', 'PUBLIC', ${sql(systemId)}),
      (${sql(draftEvent)}, ${sql(organizationId)}, ${sql(venueId)}, 'Phase 4 Draft ${suffix}', null, null, '2099-08-22T14:00:00Z', '2099-08-22T15:00:00Z', 'America/New_York', 20, '2099-08-22T13:00:00Z', 'DRAFT', 'PUBLIC', ${sql(systemId)});
  `);
  fixture = {
    systemId,
    hostEmail,
    hostPassword,
    eventA,
    eventB,
    eventNameA,
    eventNameB,
    organizationName,
    matchFirstName,
    matchLastName,
    organizationId,
    venueId,
    participationAckId,
    dataUseAckId,
  };
});

function publicRegistrationClient() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function submitPublicRegistration(eventId: string, firstName: string, lastName: string) {
  const client = publicRegistrationClient();
  return client.rpc("register_selected_events", {
    p_first_name: firstName,
    p_last_name: lastName,
    p_display_phone: `+1 (518) 555-${Math.floor(1000 + Math.random() * 8999)}`,
    p_normalized_phone: `+1518555${Math.floor(1000 + Math.random() * 8999)}`,
    p_phone_country: "US",
    p_email: `${firstName.toLowerCase().replaceAll(" ", "-")}@example.test`,
    p_normalized_email: `${firstName.toLowerCase().replaceAll(" ", "-")}@example.test`,
    p_primary_affiliation_organization_id: null,
    p_affiliation_other_text: null,
    p_fitness_experience: null,
    p_event_ids: [eventId],
    p_participation_acknowledgment_version_id: fixture.participationAckId,
    p_data_use_acknowledgment_version_id: fixture.dataUseAckId,
    p_participation_acknowledged_at: new Date().toISOString(),
    p_data_use_acknowledged_at: new Date().toISOString(),
    p_ip_address: "127.0.0.1",
    p_user_agent: "phase-4-concurrency-test",
    p_idempotency_key: randomUUID(),
  } as never);
}

function tokenHash(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function fillRegistration(
  page: Page,
  eventIds: string[],
  firstName: string,
  lastName: string,
  phone: string,
  email: string,
) {
  await page.goto("/registration");
  for (const eventId of eventIds)
    await page.locator(`input[name="eventIds"][value="${eventId}"]`).check();
  await page.getByLabel("First name").fill(firstName);
  await page.getByLabel("Last name").fill(lastName);
  await page.getByLabel("Mobile phone").fill(phone);
  await page.getByLabel("Email (optional)").fill(email);
  await page.getByLabel("Participation acknowledgment.").check();
  await page.getByLabel("Synthetic data-use acknowledgment.").check();
  await page.getByRole("button", { name: "Book Class" }).click();
}

test("registers multiple dates, exports only successful events, and scopes the admin roster", async ({
  page,
}) => {
  await fillRegistration(
    page,
    [fixture.eventA, fixture.eventB],
    "José",
    "Van Dyke",
    "(703) 555-1212",
    "jose@example.test",
  );
  await expect(page).toHaveURL(/\/registration\/confirmation\?token=/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Your spot is saved" })).toBeVisible();
  await expect(page.getByText(/We’re looking forward to seeing you, José\./)).toBeVisible();
  await expect(page.getByRole("link", { name: "Google Calendar" })).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Apple / Outlook Calendar" })).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "What to Bring" })).toHaveCount(1);
  await expect(page.getByText("Arrive early.")).toHaveCount(2);
  const token = new URL(page.url()).searchParams.get("token");
  expect(token).toMatch(/^[A-Za-z0-9_-]{40,60}$/);
  const ics = await page.request.get(
    `/registration/confirmation/ics?token=${encodeURIComponent(token!)}`,
  );
  expect(ics.status()).toBe(200);
  const body = await ics.text();
  expect(body).toContain("BEGIN:VCALENDAR\r\n");
  expect((body.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
  expect(body).toContain(`SUMMARY:${fixture.eventNameA}`);
  expect(body).not.toContain("jose@example.test");
  expect(
    localQuery(
      `select count(*) from public.registrations r join public.events e on e.id=r.event_id where e.id in (${sql(fixture.eventA)},${sql(fixture.eventB)}) and r.registration_status='REGISTERED'`,
    ),
  ).toBe("2");

  await page.goto(`/admin/sign-in?next=${encodeURIComponent(`/admin/events/${fixture.eventA}`)}`);
  await page.getByLabel("Email").fill(fixture.hostEmail);
  await page.getByLabel("Password").fill(fixture.hostPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/events/${fixture.eventA}`));
  await expect(page.getByText("José Van Dyke")).toBeVisible();
  await page.goto(`/admin/events/${fixture.eventB}`);
  await expect(page.getByText("José Van Dyke")).toBeVisible();
});

test("reuses an exact normalized participant match and rejects an altered token", async ({
  page,
}) => {
  const participantId = randomUUID();
  localSql(`insert into public.participants (id, first_name, last_name, normalized_first_name, normalized_last_name, display_phone, normalized_phone, phone_country, email, normalized_email, fitness_experience)
    values (${sql(participantId)}, ${sql(fixture.matchFirstName)}, ${sql(fixture.matchLastName)}, ${sql(fixture.matchFirstName.toLowerCase())}, ${sql(fixture.matchLastName.toLowerCase())}, '+17035551213', '+17035551213', 'US', 'old@example.test', 'old@example.test', 'protected history');`);
  await fillRegistration(
    page,
    [fixture.eventA],
    ` ${fixture.matchFirstName} `,
    ` ${fixture.matchLastName} `,
    "1 (703) 555-1213",
    "new@example.test",
  );
  await expect(page).toHaveURL(/\/registration\/confirmation\?token=/, { timeout: 15000 });
  const token = new URL(page.url()).searchParams.get("token");
  expect(token).toBeTruthy();
  expect(
    localQuery(`select count(*) from public.participants where id=${sql(participantId)}`),
  ).toBe("1");
  expect(
    localQuery(
      `select count(*) from public.registrations where participant_id=${sql(participantId)} and event_id=${sql(fixture.eventA)} and registration_status='REGISTERED'`,
    ),
  ).toBe("1");
  expect(localQuery(`select status from public.participants where id=${sql(participantId)}`)).toBe(
    "ACTIVE",
  );
  await page.goto(`/registration/confirmation?token=${encodeURIComponent(`${token}x`)}`);
  await expect(page.getByText("This confirmation link is invalid or has expired.")).toBeVisible();
});

test("serializes final-spot registration through the public RPC without orphaned success records", async ({
  page,
}) => {
  const repetitions = 3;
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const eventId = randomUUID();
    const existingParticipantId = randomUUID();
    const existingGroupId = randomUUID();
    const existingRegistrationId = randomUUID();
    const suffix = randomUUID().slice(0, 8);
    localSql(`
      insert into public.events (id, host_organization_id, venue_id, name, starts_at, ends_at, timezone, capacity, registration_deadline, status, visibility, created_by_admin_id)
      values (${sql(eventId)}, ${sql(fixture.organizationId)}, ${sql(fixture.venueId)}, ${sql(`Concurrency ${suffix}`)}, '2099-09-01T14:00:00Z', '2099-09-01T15:00:00Z', 'America/New_York', 2, '2099-09-01T13:00:00Z', 'OPEN', 'PUBLIC', ${sql(fixture.systemId)});
      insert into public.participants (id, first_name, last_name, normalized_first_name, normalized_last_name, display_phone, normalized_phone, phone_country)
      values (${sql(existingParticipantId)}, 'Existing', ${sql(suffix)}, 'existing', ${sql(suffix)}, '+15185550001', '+15185550001', 'US');
      insert into public.registration_groups (id, participant_id, submission_source, participation_acknowledgment_version_id, participation_acknowledged_at, data_use_acknowledgment_version_id, data_use_acknowledged_at)
      values (${sql(existingGroupId)}, ${sql(existingParticipantId)}, 'PUBLIC', ${sql(fixture.participationAckId)}, now(), ${sql(fixture.dataUseAckId)}, now());
      insert into public.registrations (id, registration_group_id, participant_id, event_id, registration_status, registration_outcome)
      values (${sql(existingRegistrationId)}, ${sql(existingGroupId)}, ${sql(existingParticipantId)}, ${sql(eventId)}, 'REGISTERED', 'ACTIVE');
    `);
    expect(
      localQuery(
        `select count(*) from public.registrations where event_id=${sql(eventId)} and registration_status='REGISTERED' and registration_outcome='ACTIVE'`,
      ),
    ).toBe("1");

    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const attempts = ["Concurrency Alpha", "Concurrency Beta"].map(async (name) => {
      await barrier;
      return submitPublicRegistration(eventId, name, suffix);
    });
    release();
    const results = await Promise.all(attempts);
    const successful = results.filter(
      (result) =>
        !result.error &&
        Boolean(
          (result.data as { results?: Array<{ success: boolean }> } | null)?.results?.some(
            (item) => item.success,
          ),
        ),
    );
    const rejected = results.filter(
      (result) =>
        !result.error &&
        (
          result.data as { results?: Array<{ success: boolean; reason?: string }> } | null
        )?.results?.every((item) => !item.success && item.reason === "FULL"),
    );
    expect(successful).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(
      localQuery(
        `select count(*) from public.registrations where event_id=${sql(eventId)} and registration_status='REGISTERED' and registration_outcome='ACTIVE'`,
      ),
    ).toBe("2");
    expect(
      localQuery(
        `select count(*) from public.registrations r join public.registration_groups g on g.id=r.registration_group_id where r.event_id=${sql(eventId)} and r.registration_status='REGISTERED' and r.registration_outcome='ACTIVE' and g.participant_id in (select id from public.participants where first_name like 'Concurrency %' and last_name=${sql(suffix)})`,
      ),
    ).toBe("1");
    expect(
      localQuery(
        `select count(*) from public.participants where first_name like 'Concurrency %' and last_name=${sql(suffix)}`,
      ),
    ).toBe("2");
    expect(
      localQuery(
        `select count(*) from public.acknowledgment_acceptances a join public.registration_groups g on g.id=a.registration_group_id where g.participant_id in (select id from public.participants where first_name like 'Concurrency %' and last_name=${sql(suffix)})`,
      ),
    ).toBe("4");
    expect(
      localQuery(
        `select count(*) from public.registrations r join public.registration_groups g on g.id=r.registration_group_id where r.event_id=${sql(eventId)} and g.participant_id in (select id from public.participants where first_name like 'Concurrency %' and last_name=${sql(suffix)})`,
      ),
    ).toBe("1");
    expect(
      localQuery(
        `select count(*) from public.registration_groups g where g.participant_id in (select id from public.participants where first_name like 'Concurrency %' and last_name=${sql(suffix)}) and not exists (select 1 from public.registrations r where r.registration_group_id=g.id)`,
      ),
    ).toBe("1");
    const successfulToken = (successful[0].data as { confirmation_token: string })
      .confirmation_token;
    expect(successfulToken).toMatch(/^[A-Za-z0-9_-]{40,60}$/);
    expect(
      localQuery(
        `select count(*) from public.confirmation_tokens where token_hash=decode(${sql(tokenHash(successfulToken))}, 'hex')`,
      ),
    ).toBe("1");
    const failedToken = (rejected[0].data as { confirmation_token: string }).confirmation_token;
    const failedConfirmation = await page.request.get(
      `/registration/confirmation?token=${encodeURIComponent(failedToken)}`,
    );
    expect(await failedConfirmation.text()).toContain(
      "This confirmation link is invalid or has expired.",
    );
    const failedIcs = await page.request.get(
      `/registration/confirmation/ics?token=${encodeURIComponent(failedToken)}`,
    );
    expect(failedIcs.status()).toBe(404);
    expect(await failedIcs.text()).not.toContain("BEGIN:VEVENT");
  }
});

test("confirmation and ICS reject the complete malformed, expired, and cross-group token matrix", async ({
  page,
}) => {
  const groupA = await submitPublicRegistration(
    fixture.eventA,
    "Token Scope Alpha",
    `A${randomUUID().slice(0, 7)}`,
  );
  const groupB = await submitPublicRegistration(
    fixture.eventB,
    "Token Scope Beta",
    `B${randomUUID().slice(0, 7)}`,
  );
  expect(groupA.error).toBeNull();
  expect(groupB.error).toBeNull();
  const tokenA = (groupA.data as { confirmation_token: string }).confirmation_token;
  const tokenB = (groupB.data as { confirmation_token: string }).confirmation_token;
  expect(tokenA).not.toBe(tokenB);
  localSql(
    `update public.confirmation_tokens set expires_at=now() - interval '1 second' where token_hash=decode(${sql(tokenHash(tokenB))}, 'hex');`,
  );

  const invalidTokens = [
    "malformed",
    randomBytes(32).toString("base64url"),
    `${tokenA.slice(0, -1)}${tokenA.endsWith("A") ? "B" : "A"}`,
    "",
    "   ",
    "x".repeat(500),
    "%E0%A4%A",
    "\u0000\u{1F4A9}",
    tokenB,
  ];
  const genericError = "This confirmation link is invalid or has expired.";
  for (const token of invalidTokens) {
    const response = await page.request.get(
      `/registration/confirmation?token=${encodeURIComponent(token)}`,
    );
    const body = await response.text();
    expect(response.status()).toBe(200);
    expect(body).toContain(genericError);
    expect(body).not.toContain("Token Scope Alpha");
    expect(body).not.toContain("Token Scope Beta");
    expect(body).not.toContain("registration_group_id");
    expect(body).not.toContain("token_hash");
    const ics = await page.request.get(
      `/registration/confirmation/ics?token=${encodeURIComponent(token)}`,
    );
    expect(ics.status()).toBe(404);
    expect(await ics.text()).not.toContain("BEGIN:VEVENT");
  }
  const valid = await page.goto(`/registration/confirmation?token=${encodeURIComponent(tokenA)}`);
  const validBody = await page.locator("main").last().innerText();
  expect(valid?.status()).toBe(200);
  await expect(page.getByText(/We’re looking forward to seeing you, Token\./)).toBeVisible();
  expect(validBody).not.toContain("Token Scope Alpha");
  expect(validBody).not.toContain("Token Scope Beta");
  expect(validBody).toContain("Google Calendar");
  await expect(page.locator('input[name="confirmationToken"]')).toHaveValue(tokenA);
  const replay = await page.request.get(
    `/registration/confirmation?token=${encodeURIComponent(tokenA)}&registration_group_id=${randomUUID()}&registration_id=${randomUUID()}`,
  );
  expect(replay.status()).toBe(200);
  expect(await replay.text()).toContain(fixture.eventNameA);
  const scopedIcs = await page.request.get(
    `/registration/confirmation/ics?token=${encodeURIComponent(tokenA)}&event=${fixture.eventB}`,
  );
  expect(scopedIcs.status()).toBe(404);
  const allIcs = await page.request.get(
    `/registration/confirmation/ics?token=${encodeURIComponent(tokenA)}`,
  );
  const icsBody = await allIcs.text();
  expect(allIcs.status()).toBe(200);
  expect(allIcs.headers()["content-type"]).toContain("text/calendar");
  expect(allIcs.headers()["content-disposition"]).toContain("fitness-events.ics");
  expect((icsBody.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1);
  expect(icsBody).toContain(fixture.eventNameA);
  expect(icsBody).not.toContain(fixture.eventNameB);
  expect(icsBody).not.toContain(tokenA);
  expect(icsBody).not.toContain(tokenHash(tokenA));
  expect(
    (await page.context().cookies()).filter((cookie) => cookie.name.includes("confirmation")),
  ).toHaveLength(0);
  await page.goto("/");
  expect(
    await page.evaluate(() => JSON.stringify({ local: localStorage, session: sessionStorage })),
  ).not.toContain(tokenA);
});
