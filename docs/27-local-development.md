# Local development

Prerequisites: Node 22.x, pnpm 10.x via Corepack, Docker, and Supabase CLI 2.110.0 (or a reviewed
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
slugs. Never run this command against a hosted project:

```bash
pnpm demo:reset
cat .demo-credentials.local
cat .demo-routes.local.md
```

The fixture roles are System Admin, Organization A Host Admin, Organization B Host Admin,
authenticated non-admin, and inactive Host Admin. The inventory includes organizations, active and
inactive venues, recurring weekly events, open/full/paused/not-yet-open/closed/cancelled/unpublished
states, communication-link and no-link events, first-time/returning/cross-venue participants,
multi-state registration history, attendance, follow-ups, and pending/expired/revoked invitations.

Run the focused role smoke before the broader suite:

```bash
pnpm test:demo-auth
pnpm test:e2e
pnpm test:legal
```

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
