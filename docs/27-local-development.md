# Local development

Prerequisites: Node 22.22.1, pnpm 10.15.1 via Corepack, Docker, and Supabase CLI 2.110.0 (or a reviewed
compatible version). From a clean checkout:

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm db:start
pnpm db:status
pnpm db:reset
pnpm dev
```

Use the local URL/key output from `pnpm db:status` in `.env.local`; never paste the service key into
documentation or chat. Local routes are `/`, `/events`, `/registration`, `/register/<slug>`, and
`/admin/sign-in`. The admin area is server-authorized and does not have public signup.

For owner walkthroughs, reset the local synthetic pilot data. The reset does not restart Supabase;
it clears only the running local database, creates fresh Auth identities, resolves their generated
IDs into matching application profiles and assignments, and writes random credentials to an ignored
`.demo-credentials.local` file. It also writes `.demo-routes.local.md` with the generated public
slugs. The reset and verification scripts refuse `APP_ENV=production` and refuse any Supabase API
other than `http://127.0.0.1:54321`. Never run this workflow against a hosted project:

```bash
pnpm demo:reset
cat .demo-credentials.local
cat .demo-routes.local.md
pnpm fixtures:verify
```

The fixture roles are System Admin, Organization A Host Admin, Organization B Host Admin,
authenticated non-admin, and inactive Host Admin. Participant records are synthetic and intentionally
have no login because participant accounts are outside MVP: New, Returning, Existing Registered,
Walk-in, and Capacity/Duplicate. The inventory includes two active organizations, two active venues
per organization, recurring multi-date events, open/full/paused/not-yet-open/closed/cancelled/
unpublished states, communication-link and no-link events, registrations, finalized attendance,
follow-up history, and pending/expired/revoked invitations.

Run the focused role smoke before the broader suite:

```bash
pnpm test:demo-auth
pnpm test:e2e
pnpm test:legal
```

Mail remains local. Open the Supabase Mailpit inbox at `http://127.0.0.1:54324`; do not configure
external SMTP for this workflow. Use the following validation commands:

```bash
pnpm test                         # unit/component tests
bash scripts/validate-database.sh # migration replay, SQL assertions, runtime/integration checks
pnpm test:e2e                     # Playwright browser regression
pnpm test:demo-auth               # role authentication and Host A/B isolation smoke
```

Suggested principal journey order: run `pnpm fixtures:reset`, sign in as each of the three active
admin accounts, verify Host Admin A cannot open Organization B event/roster URLs, register the New
participant for the published multi-date event, attempt the Full Event with the Capacity/Duplicate
participant, inspect the Existing Registered and Returning records, and use the System Admin
workspace to inspect the finalized attendance and follow-up state. Use the Walk-in participant only
from an event with attendance `OPEN`.

Email/password remains the local administrator authentication path. Google OAuth is not currently
implemented: there is no provider callback, sign-in button, or application OAuth handler. Enabling
it later requires Supabase Google provider configuration, a Google Cloud OAuth client with separate
local and hosted callback URLs, and server-side invitation email matching. Google authentication
alone must never grant a role. X/Twitter OAuth is deferred because the invitation model requires a
reliably verified email and X availability varies by developer account and API plan; no X provider,
credentials, dependency, or UI is enabled.

Other gates: `pnpm test`, `pnpm test:concurrency`, `pnpm type-check`, `pnpm lint`,
`pnpm format-check`, `pnpm build`, and `bash scripts/validate-database.sh`. Stop with
`pnpm db:stop`. Mailpit is available from the local Supabase dashboard for invitation testing.

Troubleshooting: Docker must be running; run `pnpm db:status` before browser tests; if the local
stack is stale, `pnpm db:stop && pnpm db:start`; if migrations fail, preserve the output and inspect
the first failing migration rather than editing history. Do not reset a hosted database.
