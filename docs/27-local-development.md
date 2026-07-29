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

For synthetic browser users and fixture data, run the phase-specific Playwright suite. The harness
generates accounts at runtime and does not document passwords:

```bash
pnpm fixtures:reset
pnpm test:e2e
pnpm test:legal
```

Other gates: `pnpm test`, `pnpm test:concurrency`, `pnpm type-check`, `pnpm lint`,
`pnpm format-check`, `pnpm build`, and `bash scripts/validate-database.sh`. Stop with
`pnpm db:stop`. Mailpit is available from the local Supabase dashboard for invitation testing.

Troubleshooting: Docker must be running; run `pnpm db:status` before browser tests; if the local
stack is stale, `pnpm db:stop && pnpm db:start`; if migrations fail, preserve the output and inspect
the first failing migration rather than editing history. Do not reset a hosted database.
