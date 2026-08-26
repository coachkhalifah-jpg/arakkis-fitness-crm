# Test environment

## Local startup

Prerequisites: Node 22.22.1, pnpm 10.15.1/Corepack, Docker, and Supabase CLI 2.110.0 or a reviewed compatible version.

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm db:start
pnpm db:status
pnpm db:reset
pnpm uat:start
```

Local application: `http://127.0.0.1:3000`. Supabase API: `http://127.0.0.1:54321`. Mailpit: `http://127.0.0.1:54324`. Never paste or document the keys printed by `db:status`.

## Fixtures and personas

Use `pnpm fixtures:reset` for the permanent local Product Owner Manual UAT environment and `pnpm fixtures:verify` for fixture validation. Generated `.demo-credentials.local` and `.demo-routes.local.md` are ignored and must never be committed or copied into reports. The four standard local-only personas are System Admin, Organization A/B Host Admins, and Empty Organization Host Admin; regression personas and synthetic participants remain available.

Seeded journey states include active organizations and Venues, recurring/open/full/paused/not-yet-open/closed/cancelled/unpublished/draft/reopened Events, registrations, finalized attendance, follow-up history, invitation states, and an empty Host Admin scope.

The standard Product Owner URL is `http://127.0.0.1:3000`. Start local Supabase with `pnpm db:start`, start the application with `pnpm uat:start`, and stop the local stack with `pnpm db:stop`. `pnpm uat:start` refuses to start if port 3000 is owned by another project; it reports the existing PID and project path instead of selecting another port. The shared UAT password is local-only and is stored in ignored `.env.local` as `LOCAL_UAT_PASSWORD`; it is not committed to the repository.

## Safety guards

Fixture reset and Storage cleanup refuse production or hosted Supabase URLs. Local tests use synthetic identities only. Playwright runs with one worker because tests mutate a shared local database. Do not run reset commands against staging or production. Do not use real participant data or credentials. Stop with `pnpm db:stop`.
