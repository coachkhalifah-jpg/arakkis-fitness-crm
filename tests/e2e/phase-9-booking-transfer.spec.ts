import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
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

function dbContainer() {
  const configured = process.env.ARAKKIS_TRANSFER_DB_CONTAINER;
  if (configured) return configured;
  const container = execFileSync(
    "docker",
    ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
    { encoding: "utf8" },
  ).trim();
  if (!container || container.includes("\n")) {
    throw new Error("Set ARAKKIS_TRANSFER_DB_CONTAINER when multiple local databases are running");
  }
  return container;
}

function localSql(statement: string) {
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      dbContainer(),
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
  return execFileSync(
    "docker",
    [
      "exec",
      dbContainer(),
      "psql",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-c",
      statement,
    ],
    { encoding: "utf8" },
  ).trim();
}

function serviceClient() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

test.describe("same-series booking transfer browser contract", () => {
  let adminId: string;
  let organizationId: string;
  let venueId: string;
  let seriesId: string;
  let otherSeriesId: string;
  let participantId: string;
  let groupId: string;
  let expiredGroupId: string;
  let sourceEventId: string;
  let targetEventId: string;
  let crossEventId: string;
  let sourceRegistrationId: string;
  let confirmationToken: string;
  let expiredToken: string;

  test.beforeAll(async () => {
    const service = serviceClient();
    const suffix = randomUUID().slice(0, 8);
    const version = 79000 + (Number.parseInt(suffix, 16) % 100000);
    const email = `phase9-transfer-${suffix}@example.test`;
    const password = `${randomBytes(24).toString("base64url")}Aa1!`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user)
      throw new Error(`Could not create transfer browser admin: ${error?.message}`);

    adminId = data.user.id;
    organizationId = randomUUID();
    venueId = randomUUID();
    seriesId = randomUUID();
    otherSeriesId = randomUUID();
    participantId = randomUUID();
    groupId = randomUUID();
    expiredGroupId = randomUUID();
    sourceEventId = randomUUID();
    targetEventId = randomUUID();
    crossEventId = randomUUID();
    sourceRegistrationId = randomUUID();
    const participationAckId = randomUUID();
    const dataUseAckId = randomUUID();
    confirmationToken = `phase9-confirmation-${suffix}-abcdefghijklmnopqrstuvwxyz`;
    expiredToken = `phase9-expired-${suffix}-abcdefghijklmnopqrstuvwxyz`;

    localSql(`
      insert into public.admin_profiles (id, display_name, email, role, status)
      values (${sql(adminId)}, 'Phase 9 Transfer Browser Admin', ${sql(email)}, 'SYSTEM_ADMIN', 'ACTIVE');
      insert into public.organizations (id, name)
      values (${sql(organizationId)}, ${sql(`Phase 9 Transfer Browser Organization ${suffix}`)});
      insert into public.venues (id, organization_id, name, street, city, state, postal_code, timezone)
      values (${sql(venueId)}, ${sql(organizationId)}, 'Phase 9 Transfer Browser Studio', '1 Transfer Street', 'Albany', 'NY', '12207', 'America/New_York');
      insert into public.event_series (id, frequency, interval_count, ends_on, selection_window_days, created_by_admin_id)
      values
        (${sql(seriesId)}, 'WEEKLY', 1, current_date + 30, 14, ${sql(adminId)}),
        (${sql(otherSeriesId)}, 'WEEKLY', 1, current_date + 30, 14, ${sql(adminId)});
      insert into public.acknowledgment_versions (id, type, version, exact_text, content_hash, effective_at, legal_status, created_by_admin_id)
      values
        (${sql(participationAckId)}, 'PARTICIPATION_RISK', ${version}, 'Synthetic browser transfer participation acknowledgment.', decode(repeat('aa', 32), 'hex'), now(), 'PROVISIONAL', ${sql(adminId)}),
        (${sql(dataUseAckId)}, 'DATA_USE', ${version}, 'Synthetic browser transfer data-use acknowledgment.', decode(repeat('bb', 32), 'hex'), now(), 'APPROVED', ${sql(adminId)});
      insert into public.participants (id, first_name, last_name, normalized_first_name, normalized_last_name, display_phone, normalized_phone, phone_country)
      values (${sql(participantId)}, 'Browser', 'Transfer', 'browser', 'transfer', '+15185550992', '+15185550992', 'US');
      insert into public.registration_groups (id, participant_id, submission_source, participation_acknowledgment_version_id, participation_acknowledged_at, data_use_acknowledgment_version_id, data_use_acknowledged_at)
      values
        (${sql(groupId)}, ${sql(participantId)}, 'PUBLIC', ${sql(participationAckId)}, now(), ${sql(dataUseAckId)}, now()),
        (${sql(expiredGroupId)}, ${sql(participantId)}, 'PUBLIC', ${sql(participationAckId)}, now(), ${sql(dataUseAckId)}, now());
      insert into public.events (id, host_organization_id, venue_id, name, description, participant_instructions, starts_at, ends_at, timezone, capacity, registration_deadline, status, visibility, publication_status, created_by_admin_id, event_series_id, series_occurrence_number)
      values
        (${sql(sourceEventId)}, ${sql(organizationId)}, ${sql(venueId)}, 'Browser Transfer Source', 'Synthetic browser transfer event.', 'Bring water.', now() + interval '2 days', now() + interval '2 days 1 hour', 'America/New_York', 10, now() + interval '1 day', 'OPEN', 'PUBLIC', 'PUBLISHED', ${sql(adminId)}, ${sql(seriesId)}, 1),
        (${sql(targetEventId)}, ${sql(organizationId)}, ${sql(venueId)}, 'Browser Transfer Target', 'Synthetic browser transfer event.', 'Bring water.', now() + interval '3 days', now() + interval '3 days 1 hour', 'America/New_York', 10, now() + interval '2 days', 'OPEN', 'PUBLIC', 'PUBLISHED', ${sql(adminId)}, ${sql(seriesId)}, 2),
        (${sql(crossEventId)}, ${sql(organizationId)}, ${sql(venueId)}, 'Browser Transfer Other Series', 'Synthetic browser transfer event.', 'Bring water.', now() + interval '3 days', now() + interval '3 days 1 hour', 'America/New_York', 10, now() + interval '2 days', 'OPEN', 'PUBLIC', 'PUBLISHED', ${sql(adminId)}, ${sql(otherSeriesId)}, 1);
      insert into public.registrations (id, registration_group_id, participant_id, event_id, registration_status, registration_outcome)
      values (${sql(sourceRegistrationId)}, ${sql(groupId)}, ${sql(participantId)}, ${sql(sourceEventId)}, 'REGISTERED', 'ACTIVE');
      insert into public.registration_group_results (registration_group_id, event_id, success, reason, registration_id)
      values (${sql(groupId)}, ${sql(sourceEventId)}, true, null, ${sql(sourceRegistrationId)});
      insert into public.confirmation_tokens (registration_group_id, token_hash, expires_at)
      values
        (${sql(groupId)}, digest(${sql(confirmationToken)}, 'sha256'), now() + interval '1 day'),
        (${sql(expiredGroupId)}, digest(${sql(expiredToken)}, 'sha256'), now() - interval '1 hour');
    `);
  });

  test.afterAll(async () => {
    if (!adminId) return;
    localSql(`
      update public.confirmation_tokens
      set revoked_at = coalesce(revoked_at, now())
      where registration_group_id in (${sql(groupId)}, ${sql(expiredGroupId)});
      update public.events
      set status = 'CLOSED', publication_status = 'UNPUBLISHED'
      where host_organization_id = ${sql(organizationId)};
      update public.venues
      set active_status = 'INACTIVE'
      where id = ${sql(venueId)};
      update public.organizations
      set active_status = 'INACTIVE'
      where id = ${sql(organizationId)};
      update public.participants
      set archived_at = coalesce(archived_at, now())
      where id = ${sql(participantId)};
    `);
  });

  test("rejects random and expired confirmation links", async ({ page }) => {
    await page.goto(
      `/manage-bookings/${sourceRegistrationId}?confirmationToken=random-invalid-${randomUUID()}`,
    );
    await expect(page.getByRole("heading", { name: "Booking could not be found." })).toBeVisible();

    await page.goto(
      `/manage-bookings/${sourceRegistrationId}?confirmationToken=${encodeURIComponent(expiredToken)}`,
    );
    await expect(page.getByRole("heading", { name: "Booking could not be found." })).toBeVisible();
  });

  test("transfers through the confirmation URL, form, action, and RPC", async ({ page }) => {
    await page.goto(
      `/manage-bookings/${sourceRegistrationId}?confirmationToken=${encodeURIComponent(confirmationToken)}`,
    );
    await expect(page.getByRole("heading", { name: "Browser Transfer Source" })).toBeVisible();
    await expect(page.locator(`option[value="${targetEventId}"]`)).toHaveCount(1);
    await expect(page.locator(`option[value="${crossEventId}"]`)).toHaveCount(0);
    await expect(page.locator('input[name="accessToken"]')).toHaveAttribute(
      "value",
      confirmationToken,
    );

    await page.getByRole("combobox", { name: "Available occurrences" }).selectOption(targetEventId);
    await page.getByRole("button", { name: "Move booking" }).click();
    await expect(
      page.getByRole("region", { name: "Choose another class in this series" }),
    ).toHaveCount(0);

    expect(
      localQuery(
        `select registration_status || ':' || registration_outcome from public.registrations where id = ${sql(sourceRegistrationId)}`,
      ),
    ).toBe("CANCELLED:PARTICIPANT_CANCELLED");
    expect(
      localQuery(
        `select count(*) from public.registrations where registration_group_id = ${sql(groupId)} and event_id = ${sql(targetEventId)} and registration_status = 'REGISTERED' and registration_outcome = 'ACTIVE'`,
      ),
    ).toBe("1");
    expect(
      localQuery(
        `select count(*) from public.participant_booking_audits where registration_id = ${sql(sourceRegistrationId)} and action = 'TRANSFERRED' and result = 'SUCCESS'`,
      ),
    ).toBe("1");
  });
});
