# 16 — Phase 1C External Database Runtime Validation

## Status

Phase 1C is **blocked**, not passed. The repository is on
`phase-1-database-schema` at checkpoint commit `09fd63d`.

The Phase 1B changes were uncommitted at the start of this continuation and
were committed as:

```text
Prepare Phase 1 database runtime validation
```

No production database, hosted Supabase project, participant records, or
database credentials were used.

## Runtime environment

Detected:

- Node.js: `v24.14.0` (workspace-bundled runtime)
- pnpm: `11.7.0`
- Homebrew: `5.1.0`

Unavailable:

- Supabase CLI
- Docker and Docker daemon
- Podman
- PostgreSQL client/server (`psql`, `postgres`)

Homebrew contains no PostgreSQL or Supabase installation. Installing a global
runtime was not performed. Package/network access is unavailable in the
execution environment, so a project-local runtime could not be installed.

## Executed checks

| Check | Result | Evidence |
|---|---|---|
| Branch and migration inventory | PASS | Branch is `phase-1-database-schema`; migrations `0001`–`0009` exist. |
| Phase 1B checkpoint commit | PASS | Commit `09fd63d`. |
| Shell syntax | PASS | `bash -n scripts/validate-database.sh` |
| Secret and machine-path scan | PASS | No matches for credentials, connection strings, or machine-specific paths. |
| Offline dependency check | PASS | `pnpm install --offline` completed. |
| Database validator fail-safe behavior | PASS | `scripts/validate-database.sh` returned exit code `2` with an explicit tooling message. |
| Type regeneration | PASS, no semantic diff | The approved generator produced 30 tables and 30 enums; migration `0009` adds no tables or enums. |

## Not executed because runtime tooling is unavailable

- Applying migrations `0001`–`0009` to an empty PostgreSQL/Supabase database.
- Repeating a clean reset and comparing the second schema.
- Live schema assertions in `supabase/tests/phase-1-schema-assertions.sql`.
- Runtime RLS tests for anonymous, System Admin, and two isolated Host Admins.
- Anonymous registration RPC scenario and contention tests.
- Constraint, trigger, attendance, capacity, acknowledgment, token, archival,
  and immutable-history execution tests.
- Official live-schema TypeScript generation.
- ESLint, strict type-check, unit tests, production build, and Playwright
  smoke tests; the project dependency tree is incomplete because registry
  downloads are unavailable.

These checks are not described as passed.

## Validation commands for a disposable local environment

After installing the supported Supabase CLI and starting its local stack:

```bash
supabase start
supabase db reset --local
supabase db reset --local
supabase db lint --local
psql "$DATABASE_URL" --set ON_ERROR_STOP=1 --single-transaction \
  -f supabase/tests/phase-1-schema-assertions.sql
bash scripts/validate-database.sh
```

The two resets intentionally prove first-apply and repeat-reset behavior.
The SQL assertion script must be run against the resulting disposable local
database and must fail the command on any assertion failure.

## Defects and corrections

The Phase 1B review identified and corrected the following runtime defects in
forward migration `0009_runtime_hardening.sql`:

- **High:** trigger-generated attendance and notification transition rows could
  be rejected by caller RLS policies. The transition functions now run as
  security-definer trigger functions while preserving `auth.uid()` as actor.
- **High:** scoped updates could mutate registration, attendance, and
  notification relationships. Forward guards now reject those mutations and
  bind operational actors/senders to the authenticated administrator.
- **Medium:** an active Host Admin could exist without an active organization
  assignment. A deferred constraint trigger now rejects that state at commit.

No Critical or High defect was validated as remaining, but the corrections are
not runtime-proven until a compatible disposable database executes them.

## Tag decision

`v0.4-schema-complete` was **not created**. The required runtime migration,
RLS, RPC, constraint, generated-live-types, and static application checks have
not all passed.

Phase 2 and user-facing application functionality were not implemented.
