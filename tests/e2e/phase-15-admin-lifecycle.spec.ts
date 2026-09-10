import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function sql(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function localSql(statement: string) {
  const container =
    process.env.PLAYWRIGHT_SUPABASE_DB_CONTAINER ||
    execFileSync("docker", ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"], {
      encoding: "utf8",
    })
      .trim()
      .split("\n")[0];
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
    { input: `begin;\n${statement};\ncommit;\n` },
  );
}

async function signIn(page: Page, email: string, password: string, expected = "workspace") {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(expected === "workspace" ? /\/admin$/ : /\/admin\/access-denied$/);
}

async function fixture() {
  const service = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  const suffix = randomUUID().slice(0, 8);
  const ownerEmail = `phase15-owner-${suffix}@example.test`;
  const hostEmail = `phase15-host-${suffix}@example.test`;
  const password = `${randomBytes(24).toString("base64url")}Aa1!`;
  const owner = await service.auth.admin.createUser({
    email: ownerEmail,
    password,
    email_confirm: true,
  });
  const host = await service.auth.admin.createUser({
    email: hostEmail,
    password,
    email_confirm: true,
  });
  if (owner.error || host.error || !owner.data.user || !host.data.user)
    throw new Error("Fixture Auth setup failed");
  const organizationA = randomUUID();
  const organizationB = randomUUID();
  localSql(`
    insert into public.organizations (id, name) values
      (${sql(organizationA)}, ${sql(`Phase 15 Organization A ${suffix}`)}),
      (${sql(organizationB)}, ${sql(`Phase 15 Organization B ${suffix}`)});
    insert into public.admin_profiles (id, display_name, email, role, status) values
      (${sql(owner.data.user.id)}, 'Phase 15 Owner', ${sql(ownerEmail)}, 'SYSTEM_ADMIN', 'ACTIVE'),
      (${sql(host.data.user.id)}, 'Phase 15 Host', ${sql(hostEmail)}, 'HOST_ADMIN', 'ACTIVE');
    insert into public.admin_organization_assignments (admin_profile_id, organization_id, created_by_admin_id)
    values (${sql(host.data.user.id)}, ${sql(organizationA)}, ${sql(owner.data.user.id)});
  `);
  return { ownerEmail, hostEmail, password, organizationA, organizationB };
}

test("System Admin lifecycle controls immediately change Host access and scope", async ({
  page,
  browser,
}) => {
  const data = await fixture();
  await signIn(page, data.ownerEmail, data.password);
  await page.goto("/admin/invitations");
  await expect(page.getByRole("heading", { name: "Administrator access" })).toBeVisible();

  const hostRecord = () =>
    page.locator("article.ops-admin-access-record").filter({ hasText: data.hostEmail });
  const formFor = (intent: string) => hostRecord().locator(`form:has(input[value="${intent}"])`);
  await formFor("DEACTIVATE_HOST_ADMIN")
    .getByPlaceholder("Operational reason")
    .fill("temporary access hold");
  await formFor("DEACTIVATE_HOST_ADMIN").getByRole("button", { name: "Deactivate" }).click();
  await expect(page.getByRole("status")).toContainText("Host Admin deactivated.");

  const hostContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  await signIn(hostPage, data.hostEmail, data.password, "denied");
  await hostPage.goto("/admin");
  await expect(hostPage).toHaveURL(/\/admin\/access-denied$/);
  await hostContext.close();

  await page.goto("/admin/invitations");
  await formFor("REACTIVATE_HOST_ADMIN")
    .getByPlaceholder("Operational reason")
    .fill("return to operations");
  await formFor("REACTIVATE_HOST_ADMIN").getByRole("button", { name: "Reactivate" }).click();
  await expect(page.getByRole("status")).toContainText("Host Admin reactivated.");

  await page.goto("/admin/invitations");
  await formFor("ADD_HOST_ADMIN_ASSIGNMENT").locator("select").selectOption(data.organizationB);
  await formFor("ADD_HOST_ADMIN_ASSIGNMENT")
    .getByPlaceholder("Operational reason")
    .fill("expand organization scope");
  await formFor("ADD_HOST_ADMIN_ASSIGNMENT")
    .getByRole("button", { name: "Add assignment" })
    .click();
  await expect(page.getByRole("status")).toContainText("Organization assignment added.");

  await page.goto("/admin/invitations");
  const revokeA = hostRecord().locator(
    `form:has(input[value="REVOKE_HOST_ADMIN_ASSIGNMENT"]):has(input[value="${data.organizationA}"])`,
  );
  await revokeA.getByPlaceholder("Operational reason").fill("remove first organization scope");
  await revokeA.getByRole("button", { name: "Revoke assignment" }).click();
  await expect(page.getByRole("status")).toContainText("Organization assignment revoked.");

  await page.goto("/admin/invitations");
  const revokeB = hostRecord().locator(
    `form:has(input[value="REVOKE_HOST_ADMIN_ASSIGNMENT"]):has(input[value="${data.organizationB}"])`,
  );
  await revokeB.getByPlaceholder("Operational reason").fill("remove final organization scope");
  await revokeB.getByRole("button", { name: "Revoke assignment" }).click();
  await expect(page.getByRole("status")).toContainText("Organization assignment revoked.");

  const finalHostContext = await browser.newContext();
  const finalHostPage = await finalHostContext.newPage();
  await signIn(finalHostPage, data.hostEmail, data.password, "denied");
  await finalHostPage.goto("/admin");
  await expect(finalHostPage).toHaveURL(/\/admin\/access-denied$/);
  await finalHostContext.close();
});
