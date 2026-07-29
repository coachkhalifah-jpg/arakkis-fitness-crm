# 16 — Phase 1D Local Supabase Database Runtime Validation

## Status

Phase 1D **passed locally** on 2026-07-28. Validation used only the local
Supabase stack and disposable transaction fixtures. No hosted project was
linked, and no production database, participant records, or credentials were
used.

## Runtime environment

Detected:

- Node.js: `v24.14.0` (workspace-bundled runtime)
- pnpm: `11.7.0`
- Homebrew: `5.1.0`
- Docker Desktop / Engine: `29.6.2`
- Supabase CLI: `2.110.0` (Homebrew)

The local stack exposed PostgreSQL on `54322`, the API/Kong gateway on
`54321`, Studio on `54323`, and Mailpit on `54324`. PostgreSQL, Auth,
PostgREST, API/Kong, Realtime, Studio, Storage API, Mailpit, and log services
were healthy/running. Imgproxy and the pooler were excluded/stopped and were
not required for database validation.

## Executed checks

| Check | Result | Evidence |
|---|---|---|
| Branch and working tree pre-check | PASS | `phase-1-database-schema`; clean before validation; starting commit `22e9b471228b3a315a384d86138648cd99ec3b8e`. |
| Docker verification | PASS | Docker Desktop running; `docker version`; disposable `hello-world` container succeeded. |
| Supabase CLI | PASS | Homebrew CLI `2.110.0`. |
| Empty migration apply | PASS | Migrations `0001`–`0012` applied in order. |
| Clean reset/rebuild #1 and #2 | PASS | Local data removed and migrations reapplied twice. |
| Schema assertions | PASS | 30 tables, 30 enums, RLS/policies/helpers/indexes/triggers, and public projection checks passed. |
| Runtime RLS/RPC suite | PASS | Anonymous, two isolated Host Admins, System Admin, and RPC replay/duplicate/partial-success/invalid-acknowledgment cases passed. |
| Constraints and immutable records | PASS | Duplicate/capacity/cancellation/attendance guards and audit immutability passed. |
| Live TypeScript generation | PASS | `supabase gen types typescript --local`; 2,252-line artifact with 30 tables and 30 enums. |
| Static checks | PASS | ESLint, strict TypeScript, Vitest (5 tests), and Next production build passed. |

## Not required for this database gate

Playwright smoke tests, Studio UI checks, Storage API checks, and Imgproxy were
not required for Phase 1D database runtime validation. No application feature
or Phase 2 workflow was started.

## Validation commands for a disposable local environment

The completed validation command was:

```bash
bash scripts/validate-database.sh
```

The script performs two disposable local rebuilds, executes schema assertions
after each rebuild, runs the live runtime suite, and runs local schema lint.

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

Phase 1D found and corrected these defects with forward migrations:

- **High:** the registration RPC contained ambiguous PL/pgSQL/SQL references;
  migrations `0010` and `0011` qualify the event row and all local variables.
- **High:** cancelled registrations/events could accept invalid attendance
  outcomes and active-registration inserts could exceed capacity;
  migration `0012` adds write-time attendance and capacity guards.

No Critical or High defect remains from the completed runtime suite.

## Tag decision

`v0.4-schema-complete` is eligible only after the required completion commit is
created. It must not be created if any mandatory check is later found to fail.

Phase 2 and user-facing application functionality were not implemented.
