# Testing handoff

| Command | Purpose |
|---|---|
| `pnpm test` | Vitest unit/component/service tests |
| `pnpm test:e2e` | full browser regression, phases 3–8 and smoke |
| `pnpm test:legal` | production-equivalent legal-gate browser test |
| `pnpm test:concurrency` | capacity and invitation concurrency scenarios |
| `bash scripts/validate-database.sh` | two migration replays, SQL assertions, runtime, schema lint, concurrency |
| `pnpm type-check` | strict TypeScript |
| `pnpm lint` | ESLint |
| `pnpm format-check` | Prettier |
| `pnpm build` | production build |
| `pnpm secret-scan` | tracked-file secret/name scan |

Browser tests require Docker/local Supabase and create synthetic users at runtime. Legal tests use
the local database in production-equivalent application mode; they must show registration blocked.
Inspect browser console and server logs for application errors, hydration warnings, tokens, and keys.

The Playwright web server uses `scripts/playwright-server.mjs`, which forwards Playwright's shutdown
signals to the child Next process and exits only after that child exits. This addresses the prior
macOS/local-runner hang where `next dev` remained listening on port 3000 after workers completed.
The default suite uses one worker because its phase fixtures intentionally mutate one shared local
Supabase database; parallel workers create cross-test invitation and registration races. The wrapper
is intentionally narrow: it does not force-kill unrelated processes or suppress test timeouts. A
normal run must leave port 3000 unused.

Phase 7 and Phase 8 suites are included in `pnpm test:e2e`; run them individually when diagnosing:
`pnpm exec playwright test tests/e2e/phase-7.spec.ts` and `.../phase-8.spec.ts`.
