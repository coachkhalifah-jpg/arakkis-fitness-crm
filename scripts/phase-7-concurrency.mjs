import { randomBytes, randomUUID, createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";

const container = execFileSync(
  "docker",
  ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
  { encoding: "utf8" },
).trim();
if (!container) throw new Error("Local Supabase database container is not running");

const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const psqlArgs = [
  "exec",
  "-i",
  container,
  "psql",
  "-X",
  "-At",
  "-v",
  "ON_ERROR_STOP=1",
  "-U",
  "postgres",
  "-d",
  "postgres",
];
const psqlCommandArgs = [
  "exec",
  container,
  "psql",
  "-X",
  "-At",
  "-v",
  "ON_ERROR_STOP=1",
  "-U",
  "postgres",
  "-d",
  "postgres",
];
const barrierKey = 735701;

function runSql(statement) {
  return execFileSync("docker", psqlArgs, { input: statement, encoding: "utf8" }).trim();
}

function runSession(statement) {
  return new Promise((resolve) => {
    const child = spawn("docker", [...psqlCommandArgs, "-c", statement], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}

function lockSession(invitationId) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", psqlArgs, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const ready = () =>
      resolve({
        release: () => {
          child.stdin.write(`select pg_advisory_unlock(${barrierKey}); commit;\n`);
          child.stdin.end();
        },
        output: () => ({ stdout, stderr }),
      });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.includes(invitationId)) ready();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code && !stdout.includes(invitationId))
        reject(new Error(stderr || `lock session exited ${code}`));
    });
    child.stdin.write("begin;\n");
    child.stdin.write(`select pg_advisory_lock(${barrierKey});\n`);
    child.stdin.write(
      `select id from public.admin_invitations where id = '${invitationId}' for update;\n`,
    );
  });
}

function waitForSessions(applicationNames) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const activity = runSql(
      `select application_name from pg_stat_activity where application_name in (${applicationNames.map(sql).join(",")}) and state <> 'idle';`,
    );
    if (new Set(activity.split("\n").filter(Boolean)).size >= applicationNames.length) return;
  }
  const activity = runSql(
    "select application_name || ':' || state from pg_stat_activity where application_name like 'phase7_concurrency_%';",
  );
  throw new Error(`Concurrent sessions did not reach the database lock boundary: ${activity}`);
}

const systemId = randomUUID();
const userOne = randomUUID();
const userTwo = randomUUID();
const organizationId = randomUUID();
const inviterEmail = `phase7-concurrency-inviter-${systemId}@example.test`;

function setupInvitation(invitedEmail = `race-one-${systemId}@example.test`) {
  const invitationId = randomUUID();
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  runSql(`
    insert into public.admin_invitations (id, invited_email, role, status, token_hash, token_expires_at, invited_by_admin_id)
    values (${sql(invitationId)}, ${sql(invitedEmail)}, 'HOST_ADMIN', 'PENDING', decode(${sql(hash)}, 'hex'), now() + interval '1 day', ${sql(systemId)});
    insert into public.admin_invitation_organizations (invitation_id, organization_id) values (${sql(invitationId)}, ${sql(organizationId)});
  `);
  return { invitationId, tokenHash: hash };
}

function acceptStatement(invitation, userId, email, name) {
  return `set application_name = 'phase7_concurrency_accept'; select pg_advisory_xact_lock(${barrierKey}); select public.accept_admin_invitation(decode('${invitation.tokenHash}', 'hex'), '${userId}', '${email}', '${name}');`;
}

async function runRace(invitationId, statements) {
  const lock = await lockSession(invitationId);
  const sessions = statements.map((statement) => runSession(statement));
  try {
    waitForSessions(statements.map((_, index) => `phase7_concurrency_${index}`));
  } catch (error) {
    lock.release();
    throw error;
  }
  lock.release();
  return Promise.all(sessions);
}

runSql(`
  insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (${sql(systemId)}, 'authenticated', 'authenticated', ${sql(inviterEmail)}, now(), now(), now()),
         (${sql(userOne)}, 'authenticated', 'authenticated', ${sql(`race-one-${systemId}@example.test`)}, now(), now(), now()),
         (${sql(userTwo)}, 'authenticated', 'authenticated', ${sql(`race-two-${systemId}@example.test`)}, now(), now(), now());
  insert into public.admin_profiles (id, display_name, email, role, status) values (${sql(systemId)}, 'Phase 7 Concurrency System', ${sql(inviterEmail)}, 'SYSTEM_ADMIN', 'ACTIVE');
  insert into public.organizations (id, name) values (${sql(organizationId)}, 'Phase 7 Concurrency Organization');
`);

try {
  const acceptInvitation = setupInvitation();
  const acceptResults = await runRace(acceptInvitation.invitationId, [
    acceptStatement(
      acceptInvitation,
      userOne,
      `race-one-${systemId}@example.test`,
      "Race One",
    ).replace("phase7_concurrency_accept", "phase7_concurrency_0"),
    acceptStatement(
      acceptInvitation,
      userOne,
      `race-one-${systemId}@example.test`,
      "Race One Retry",
    ).replace("phase7_concurrency_accept", "phase7_concurrency_1"),
  ]);
  if (acceptResults.filter((result) => result.code === 0).length !== 1)
    throw new Error(
      `accept-versus-accept result was not one winner: ${JSON.stringify(acceptResults)}`,
    );
  if (
    runSql(
      `select status from public.admin_invitations where id = '${acceptInvitation.invitationId}';`,
    ) !== "ACCEPTED"
  )
    throw new Error("accept-versus-accept did not end accepted");
  if (
    runSql(
      `select count(*) from public.admin_profiles where id in ('${userOne}','${userTwo}') and role = 'HOST_ADMIN';`,
    ) !== "1"
  )
    throw new Error("accept-versus-accept created the wrong profile count");
  if (
    runSql(
      `select count(*) from public.admin_organization_assignments where admin_profile_id in ('${userOne}','${userTwo}');`,
    ) !== "1"
  )
    throw new Error("accept-versus-accept created the wrong assignment count");
  console.log("accept-versus-accept: PASS (one winner, one profile, one assignment)");

  const revokeInvitation = setupInvitation(`race-two-${systemId}@example.test`);
  const revokeResults = await runRace(revokeInvitation.invitationId, [
    `set application_name = 'phase7_concurrency_0'; select pg_advisory_xact_lock(${barrierKey}); select public.revoke_admin_invitation('${revokeInvitation.invitationId}', '${systemId}');`,
    acceptStatement(
      revokeInvitation,
      userTwo,
      `race-two-${systemId}@example.test`,
      "Race Revoke",
    ).replace("phase7_concurrency_accept", "phase7_concurrency_1"),
  ]);
  const revokeState = runSql(
    `select status from public.admin_invitations where id = '${revokeInvitation.invitationId}';`,
  );
  if (!["ACCEPTED", "REVOKED"].includes(revokeState))
    throw new Error(`revoke-versus-accept ended in ${revokeState}`);
  if (
    revokeState === "REVOKED" &&
    runSql(`select count(*) from public.admin_profiles where id = '${userTwo}';`) !== "0"
  )
    throw new Error("revoked invitation left an assignment");
  console.log(`revoke-versus-accept: PASS (${revokeState} precedence)`);

  const regenerateInvitation = setupInvitation(`race-two-${systemId}@example.test`);
  const replacementHash = createHash("sha256").update(randomBytes(32)).digest("hex");
  const regenerateResults = await runRace(regenerateInvitation.invitationId, [
    `set application_name = 'phase7_concurrency_0'; select pg_advisory_xact_lock(${barrierKey}); select public.regenerate_admin_invitation('${regenerateInvitation.invitationId}', decode('${replacementHash}', 'hex'), now() + interval '2 days', '${systemId}');`,
    acceptStatement(
      regenerateInvitation,
      userTwo,
      `race-two-${systemId}@example.test`,
      "Race Regenerate",
    ).replace("phase7_concurrency_accept", "phase7_concurrency_1"),
  ]);
  const regenerateState = runSql(
    `select status from public.admin_invitations where id = '${regenerateInvitation.invitationId}';`,
  );
  if (!["ACCEPTED", "PENDING"].includes(regenerateState))
    throw new Error(`regenerate-versus-accept ended in ${regenerateState}`);
  if (
    Number(
      runSql(
        `select count(*) from public.admin_organization_assignments where admin_profile_id = '${userTwo}';`,
      ),
    ) > 1
  )
    throw new Error("regenerate-versus-accept duplicated assignment");
  console.log(
    `regenerate-versus-accept: PASS (${regenerateState} precedence; results ${regenerateResults.map((result) => result.code).join(",")})`,
  );

  const doubleRegenerate = setupInvitation();
  const hashOne = createHash("sha256").update(randomBytes(32)).digest("hex");
  const hashTwo = createHash("sha256").update(randomBytes(32)).digest("hex");
  const doubleResults = await runRace(doubleRegenerate.invitationId, [
    `set application_name = 'phase7_concurrency_0'; select pg_advisory_xact_lock(${barrierKey}); select public.regenerate_admin_invitation('${doubleRegenerate.invitationId}', decode('${hashOne}', 'hex'), now() + interval '2 days', '${systemId}');`,
    `set application_name = 'phase7_concurrency_1'; select pg_advisory_xact_lock(${barrierKey}); select public.regenerate_admin_invitation('${doubleRegenerate.invitationId}', decode('${hashTwo}', 'hex'), now() + interval '3 days', '${systemId}');`,
  ]);
  if (
    runSql(
      `select status from public.admin_invitations where id = '${doubleRegenerate.invitationId}';`,
    ) !== "PENDING"
  )
    throw new Error("regenerate-versus-regenerate lost pending state");
  if (
    runSql(
      `select count(*) from public.admin_invitations where id = '${doubleRegenerate.invitationId}' and status = 'PENDING';`,
    ) !== "1"
  )
    throw new Error("regenerate-versus-regenerate created duplicate state");
  if (
    runSql(
      `select count(*) from public.audit_events where entity_id = '${doubleRegenerate.invitationId}' and action = 'ADMIN_INVITATION_REGENERATED';`,
    ) !== "2"
  )
    throw new Error("regeneration audit count was not coherent");
  console.log(
    `regenerate-versus-regenerate: PASS (one pending row; results ${doubleResults.map((result) => result.code).join(",")})`,
  );
} finally {
  runSql(`
    update public.admin_invitations set status = 'REVOKED', revoked_at = coalesce(revoked_at, now()) where invited_by_admin_id = '${systemId}' and status = 'PENDING';
    update public.admin_profiles set status = 'DEACTIVATED' where id in ('${systemId}','${userOne}','${userTwo}');
    update public.organizations set active_status = 'INACTIVE', archived_at = coalesce(archived_at, now()) where id = '${organizationId}';
  `);
}
