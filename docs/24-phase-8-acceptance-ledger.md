# Phase 8 — Acceptance Ledger

| ID | Criterion | Implementation | Unit/component evidence | Browser evidence | Responsive/accessibility evidence | Status |
|---|---|---|---|---|---|---|
| P8-001 | Public event hub lists available published events in start-time order | `src/app/events/page.tsx` | `tests/pages.test.tsx` foundation coverage | `tests/e2e/phase-8.spec.ts` event-card test | Card links have accessible names; narrow-width test | PASS |
| P8-002 | Event cards show approved public information and canonical slug links | `src/app/events/page.tsx` | Type-check/build | Phase 8 card test and Phase 7 slug/QR tests | No private event ID in public markup; cards wrap fluidly | PASS |
| P8-003 | Participant can navigate landing → events → registration → confirmation | `src/app/page.tsx`, `src/app/events/page.tsx`, existing registration routes | Existing registration tests | Phase 8 participant journey | Keyboard Enter submission; mobile overflow check | PASS |
| P8-004 | Registration fields, acknowledgments, pending state, and errors remain understandable | `src/components/registration/registration-form.tsx` | `tests/component.test.tsx`, registration service tests | Phase 7 public registration tests | Native labels/required controls; visible focus and alert states | PASS |
| P8-005 | Confirmation remains token-scoped and calendar-capable | Existing confirmation/calendar routes | Phase 4 registration tests | Phase 7 and Phase 8 confirmation assertions | Download action has a meaningful link name | PASS |
| P8-006 | Admin landing/navigation preserves role-scoped sections | `src/app/admin/page.tsx`, existing auth/navigation | Auth/security tests | Existing Phase 7/auth browser suites | Responsive grid; server authorization unchanged | PASS |
| P8-007 | Reusable primitives establish consistent visual language | `src/components/ui/*`, `tailwind.config.ts`, `globals.css` | Component test for Button | Browser surfaces consume shared primitives | Shared focus, radius, shadow, disabled states | PASS |
| P8-008 | Empty/loading/unavailable states are polished and non-technical | `EmptyState`, `src/app/loading.tsx`, public pages | Type-check/build | Phase 8 invalid-slug test; existing legal/empty paths | Skeleton is `aria-busy`; mobile empty layouts are fluid | PASS |
| P8-009 | Keyboard and semantic accessibility are preserved | `globals.css`, semantic page markup | ESLint/type-check | Phase 8 keyboard journey | Focus-visible, named landmarks/links, labeled controls | PASS |
| P8-010 | Phase 7 behavior/security/legal gate is unchanged | No migration/service/domain changes | Phase 7 service tests | Phase 7, legal, auth, QR, concurrency suites | Existing Phase 7 mobile/legal assertions retained | PASS |
| P8-011 | Excluded scope remains absent | Presentation-only change set | Diff review | Regression suites | No new account/message/payment/analytics routes | PASS |

## Evidence command ledger

| Gate | Command | Result |
|---|---|---|
| TypeScript | `pnpm type-check` | PASS |
| ESLint | `pnpm lint` | PASS |
| Formatting | `pnpm format-check` | PASS |
| Unit/component | `pnpm test` | PASS — 25 tests |
| Playwright Phase 7 + Phase 8 | `pnpm test:e2e` | PASS — 46 tests |
| Playwright legal | `pnpm exec playwright test -c playwright.phase7-legal.config.ts tests/e2e/phase-7-legal.spec.ts` | PASS — 1 test |
| Phase 8 browser | `pnpm exec playwright test tests/e2e/phase-8.spec.ts` | PASS — 4 tests |
| Build | `pnpm build` | PASS |
| Database/runtime/schema | `./scripts/validate-database.sh` | PASS — two migration reset passes, schema lint, runtime, Phase 2/6/7 assertions |
| Concurrency | Included in `./scripts/validate-database.sh` | PASS — 4 scenarios |

## Clean-reset evidence

- Cycle 1: `./scripts/validate-database.sh` completed two fresh local migration replays; then `pnpm test`, `pnpm test:e2e`, the dedicated Phase 8 suite, and the isolated legal-gate browser test passed.
- Cycle 2: `./scripts/validate-database.sh` completed two further fresh local migration replays; then `pnpm test:e2e` passed 46/46 and the isolated legal-gate browser test passed 1/1.
- Historical migration integrity: `git diff --name-only v1.0-publishing-links-complete -- supabase/migrations` returned no files.
- Browser console/server review: only expected Next/Node `NO_COLOR` development warnings were emitted; no application error or hydration warning was observed.

The completion commit/tag must not be created while any mandatory gate is pending or blocked.
