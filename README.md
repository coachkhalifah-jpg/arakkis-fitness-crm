# Fitness Event CRM

A lightweight multi-organization web application for fitness event booking, attendance, participant history, and coach follow-up accountability.

## Current status
Requirements package only. Application implementation has not started.

## Recommended stack
- Next.js App Router
- TypeScript with strict mode
- shadcn/ui and Tailwind CSS
- Supabase PostgreSQL, Auth, and Row Level Security
- Server-side validation and data access with database transactions/RPCs
- Vercel
- Vitest, React Testing Library, and Playwright for testing

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
