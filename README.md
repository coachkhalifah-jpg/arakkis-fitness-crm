# Fitness Event CRM

A lightweight multi-organization web application for fitness event booking, attendance, participant history, and coach follow-up accountability.

## Current status

Phase 4 public registration, deterministic participant matching, confirmation access, calendar export,
and organization-scoped roster visibility are implemented. Attendance, participant CRM editing,
follow-up, notification delivery, and Phase 5 functionality remain deferred.

## Prerequisites and installation

- Node.js 22 and pnpm 10
- Git

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

`.env.local` must be filled with local, non-production values before the app reads the environment. Never commit it.

## Local administrator authentication

Phase 2 administrator access is invitation-only. Start local Supabase, apply the migrations with `supabase db reset` (or `bash scripts/validate-database.sh` when the installed CLI requires the local stop/start workaround), and provision a synthetic initial System Admin through the local Supabase Auth admin API plus the matching `admin_profiles` row. Sign in at `/admin/sign-in`; do not add public signup or production credentials. System Admin invitation actions return a one-time local acceptance URL for Mailpit/testing. Invitation tokens are hashed before storage and expire after 72 hours.

## Local public registration testing

Start local Supabase and apply migrations with `bash scripts/validate-database.sh` when the installed CLI requires the local stop/start workaround. Seed synthetic future `OPEN` events and active acknowledgment versions, then open `/registration`. Confirmation links expire after 24 hours; successful registrations can be exported as Google Calendar links or `.ics`. Participation acknowledgment content is still provisional, so production launch remains blocked until legal approval.

## Commands

```bash
pnpm dev             # local development
pnpm lint            # ESLint
pnpm type-check      # strict TypeScript
pnpm test            # Vitest + React Testing Library
pnpm test:e2e        # Playwright smoke test
pnpm format          # format files
pnpm format-check    # verify formatting
pnpm build           # production build
pnpm start           # serve the production build
```

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

Codex must also follow the root `AGENTS.md`.

## Repository structure

- `AGENTS.md` — project instructions and engineering guardrails
- `README.md` — project overview and workflow
- `docs/00-product-overview.md` through `docs/12-technical-design-proposal.md` — approved product and technical documentation
- `docs/DECISIONS.md` — decision history and frozen MVP baseline
- Application source and database migrations will be added only after the documentation phase is complete.

## Development workflow

1. Read the approved documentation and identify the requirement IDs in scope.
2. Inspect the relevant migrations, data-access paths, and tests.
3. Propose a small, reviewable implementation plan.
4. Implement the smallest complete vertical slice within the frozen MVP scope.
5. Add or update acceptance and regression tests.
6. Run lint, strict type-checking, migrations, unit/integration tests, and relevant E2E tests.
7. Review authorization, privacy, concurrency, and audit implications before reporting completion.

The intended MVP flow is: create and publish an event → participant selects dates → independent registrations are created → authorized administrators manage the roster → check in → finalize attendance → calculate participant history → create idempotent follow-up tasks → System Admin completes follow-up manually. Cancellation and optional WhatsApp invitation workflows remain manual and scoped as documented.
