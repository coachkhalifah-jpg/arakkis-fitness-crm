# Fitness Event CRM

A lightweight multi-organization web application for fitness event booking, attendance, participant history, and coach follow-up accountability.

## Current status

Phase 9 deployment-readiness work is documented on `codex/phase-9-deployment-operations-handoff`.
The free-tier deployment audit branch is `codex/mvp-free-tier-deployment`, based on the Phase 9
release. Local deployment, database, security, legal-gate, concurrency, and browser validation pass;
hosted deployment remains pending owner-authenticated GitHub, Supabase, and hosting accounts.
Production registration remains blocked until the Participation acknowledgment is legally approved.

## Prerequisites and installation

- Node.js 22.x and pnpm 10.x
- Git
- Docker and Supabase CLI 2.110.0

```bash
corepack enable
pnpm install
pnpm db:start
cp .env.example .env.local
pnpm db:status
pnpm dev
```

`.env.local` must be filled with local, non-production values before the app reads the environment. Never commit it.

## Local administrator authentication

Phase 2 administrator access is invitation-only. Start local Supabase, apply the migrations with `supabase db reset` (or `bash scripts/validate-database.sh` when the installed CLI requires the local stop/start workaround), and provision a synthetic initial System Admin through the local Supabase Auth admin API plus the matching `admin_profiles` row. Sign in at `/admin/sign-in`; do not add public signup or production credentials. System Admin invitation actions return a one-time local acceptance URL for Mailpit/testing. Invitation tokens are hashed before storage and expire after 72 hours.

## Local public registration testing

Start local Supabase and apply migrations with `bash scripts/validate-database.sh` when the installed CLI requires the local stop/start workaround. Seed synthetic future `OPEN` events and active acknowledgment versions, then open `/registration`. Confirmation links expire after 24 hours; successful registrations can be exported as Google Calendar links or `.ics`. Participation acknowledgment content is still provisional, so production launch remains blocked until legal approval.

## Commands

```bash
pnpm dev              # Next.js development server
pnpm dev:stack        # local Supabase then Next.js
pnpm db:start         # start local Supabase/Docker stack
pnpm db:status        # show local services and keys; do not paste secrets
pnpm db:reset         # recreate local database and apply migrations
pnpm fixtures:reset   # verify synthetic fixture workflow; refuses production
pnpm demo:reset       # reset local Supabase and create synthetic pilot fixtures
pnpm test:demo-auth   # reset local fixtures and run the focused demo-role browser smoke test
pnpm test             # Vitest + component tests
pnpm test:e2e         # browser regression suite
pnpm test:legal       # production-equivalent legal-gate test
pnpm test:concurrency # capacity/invitation concurrency scenarios
pnpm lint             # ESLint
pnpm type-check       # strict TypeScript
pnpm format-check     # Prettier verification
pnpm build            # production build
pnpm validate         # formatting, lint, type, unit, secret scan, build
pnpm db:stop          # stop local stack
```

## Local routes

- Participant registration: `http://127.0.0.1:3000/registration`
- Events hub: `http://127.0.0.1:3000/events`
- Stable event registration: `http://127.0.0.1:3000/register/<slug>`
- Administrator login: `http://127.0.0.1:3000/admin/sign-in`

`pnpm demo:reset` creates fresh local-only Auth users and writes their random credentials to the
ignored `.demo-credentials.local` file. It also writes a generated route index to
`.demo-routes.local.md`. Both files are replaced on every reset and must never be staged or used
outside local development. See `docs/27-local-development.md` for the complete local workflow.

## Phase 0 scope

This phase establishes the Next.js App Router shell, TypeScript, Tailwind CSS, shadcn/ui configuration, environment validation, server-only Supabase client boundaries, tests, CI, and documentation. The public page confirms the foundation is running; `/admin` is explicitly a development placeholder.

Phase 1 adds the approved Supabase/PostgreSQL schema, migrations, RLS policies, database invariants, and generated database types. Application workflows remain deferred until later phases.

The Participation acknowledgment is still PROVISIONAL. Legal review and an APPROVED acknowledgment version are production-launch blockers.

## Project structure

- `src/app` — App Router pages, shell, loading, errors, and not-found handling
- `src/components/ui` — small reusable UI primitives
- `src/lib/config` — validated environment access
- `src/lib/db` — browser, server, and privileged server-only Supabase client boundaries
- `supabase/migrations` — ordered Phase 1 PostgreSQL/Supabase migrations
- `src/types/generated` — generated database types (regenerate with `node scripts/generate-database-types.mjs`)
- `tests` — unit/component and Playwright smoke tests
- `docs` — approved requirements and implementation records

## Security and dependency hygiene

Only `NEXT_PUBLIC_*` values may be used by browser-safe modules. The service-role client is marked server-only and is reserved for trusted server workflows. No credentials or real project values belong in this repository.

Review dependency changes with `pnpm audit` and the lockfile before upgrading. Do not apply automatic destructive upgrades; review and test upgrades deliberately.

## Documentation order

Start with:

1. `docs/00-product-overview.md`
2. `docs/01-personas.md`
3. `docs/02-user-journeys.md`
4. `docs/03-functional-requirements.md`
5. `docs/04-business-rules.md`
6. `docs/05-data-model.md`
7. `docs/06-permissions-matrix.md`
8. `docs/07-ui-specification.md`
9. `docs/08-mvp-scope.md`
10. `docs/09-acceptance-tests.md`
11. `docs/10-build-plan.md`
12. `docs/12-technical-design-proposal.md`
13. `docs/DECISIONS.md`
14. `docs/25-phase-9-deployment-operations-handoff.md`
15. `docs/26-environment-variables.md`
16. `docs/27-local-development.md`
17. `docs/28-deployment-runbook.md`
18. `docs/29-operational-readiness.md`
19. `docs/30-architecture-handoff.md`
20. `docs/31-database-and-migrations-handoff.md`
21. `docs/32-testing-handoff.md`
22. `docs/33-manual-testing.md`
23. `docs/34-developer-handoff.md`
24. `docs/35-phase-9-acceptance-ledger.md`

Codex must also follow the root `AGENTS.md`.

## Repository structure

- `AGENTS.md` — project instructions and engineering guardrails
- `README.md` — project overview and workflow
- `docs/00-product-overview.md` through `docs/12-technical-design-proposal.md` — approved product and technical documentation
- `docs/DECISIONS.md` — decision history and frozen MVP baseline
- Application source and database migrations are maintained alongside the approved documentation;
  migrations are ordered, reviewed, and immutable after application.

## Development workflow

1. Read the approved documentation and identify the requirement IDs in scope.
2. Inspect the relevant migrations, data-access paths, and tests.
3. Propose a small, reviewable implementation plan.
4. Implement the smallest complete vertical slice within the frozen MVP scope.
5. Add or update acceptance and regression tests.
6. Run lint, strict type-checking, migrations, unit/integration tests, and relevant E2E tests.
7. Review authorization, privacy, concurrency, and audit implications before reporting completion.

The intended MVP flow is: create and publish an event → participant selects dates → independent registrations are created → authorized administrators manage the roster → check in → finalize attendance → calculate participant history → create idempotent follow-up tasks → System Admin completes follow-up manually. Cancellation and optional WhatsApp invitation workflows remain manual and scoped as documented.
