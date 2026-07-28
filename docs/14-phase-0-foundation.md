# Phase 0 — Project Foundation

## Work completed

- Created the `phase-0-project-foundation` branch.
- Added a Next.js App Router application with TypeScript strict mode, React, Tailwind CSS, ESLint, Prettier, Vitest, React Testing Library, and Playwright.
- Added a minimal public landing page, responsive navigation, `/admin` development placeholder, loading state, not-found page, and generic error boundary.
- Added environment validation with separate public and server-only schemas.
- Added browser, request-server, and privileged server-only Supabase client boundaries. No live connection is required.
- Added CI for dependency installation, formatting, linting, type-checking, unit tests, and production build.

## Technology choices

- Next.js App Router and React Server Components for the application shell.
- TypeScript strict mode and Zod for typed configuration validation.
- Tailwind CSS with shadcn/ui-compatible configuration and small local primitives.
- Supabase SSR helpers with an explicit `server-only` privileged client boundary.
- Vitest/React Testing Library for unit/component tests and Playwright for local browser smoke coverage.

## Structure

Application code lives under `src/app`, `src/components`, and `src/lib`. Tests are under `tests`, CI is under `.github/workflows`, and future database/auth work is intentionally not present.

## Commands and tests

See the command list in `README.md`. Foundational tests cover both shell pages, environment validation, the Button primitive, and a public Playwright smoke test.

## Deferred items and known limitations

Playwright is not included in CI because Phase 0 has no external service-backed flows and browser installation adds CI complexity without increasing coverage of the foundation gates. The `/admin` route has no authentication or authorization. Supabase clients are structural only and do not connect to a project until a later phase.

The Participation acknowledgment remains provisional; production deployment must remain blocked until legal approval and an approved version exist.

## Scope confirmation

No business features, database schema, SQL migrations, RLS policies, authentication workflows, or credentials were implemented in Phase 0.
