# Test environment

## Local startup

Prerequisites: Node 22.x, pnpm 10.x/Corepack, Docker, and Supabase CLI 2.110.0 or a reviewed compatible version.

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm db:start
pnpm db:status
pnpm db:reset
pnpm dev
```

Local application: `http://127.0.0.1:3000`. Supabase API: `http://127.0.0.1:54321`. Mailpit: `http://127.0.0.1:54324`. Never paste or document the keys printed by `db:status`.

## Fixtures and personas

Use `pnpm demo:reset` for the synthetic pilot and `pnpm fixtures:reset`/`pnpm fixtures:verify` for fixture validation. Generated `.demo-credentials.local` and `.demo-routes.local.md` are ignored and must never be committed or copied into reports. Personas include System Admin, Organization A/B Host Admins, authenticated non-admin, inactive admin, and synthetic participants New, Returning, Existing Registered, Walk-in, and Capacity/Duplicate.

Seeded journey states include active organizations and Venues, recurring/open/full/paused/not-yet-open/closed/cancelled/unpublished Events, registrations, finalized attendance, follow-up history, and invitation states.

## Safety guards

Fixture reset and Storage cleanup refuse production or hosted Supabase URLs. Local tests use synthetic identities only. Playwright runs with one worker because tests mutate a shared local database. Do not run reset commands against staging or production. Do not use real participant data or credentials. Stop with `pnpm db:stop`.
