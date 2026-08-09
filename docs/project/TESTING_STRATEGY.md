# Testing strategy

## Order and scope

Start with the smallest targeted test for the changed acceptance boundary. Expand only when risk, shared architecture, or a focused failure justifies it. At milestone boundaries run the broader relevant phase suites and production build; do not use broad regression to discover unrelated scope.

## Layers

- Unit/component: validation, lifecycle state machines, intent signatures, UI semantics, and failure boundaries.
- Service/action: authorization, input validation, audit, rollback, Storage cleanup, and idempotency.
- SQL/RPC/RLS: migration replay, constraints, grants, transaction behavior, replay/tampering, and cross-Organization scope.
- Storage: MIME/size limits, asset references, replacement atomicity, retired-object cleanup, and orphan audits.
- Playwright: journey behavior, direct routes, role visibility, manipulated requests, mobile widths, keyboard/focus, and rendering after refresh.
- Manual UAT: journey-based product verification with synthetic data and recorded evidence.

## Gates

Run `pnpm type-check`, `pnpm lint`, `pnpm format-check`, `pnpm secret-scan`, `pnpm build`, `git diff --check`, focused unit/service/authorization tests, and the relevant Playwright/SQL checks. Full E2E and clean migration replay are required at release/milestone boundaries or for changes touching shared authorization, database, routing, or public registration architecture.

## Acceptance boundaries

Focused QA tests the fixed acceptance boundary, including success, failure, authorization, direct-route, and manipulated-request paths. Do not expand a bug fix into new product behavior. If the repository requirements conflict, stop and record the conflict rather than making QA itself the mechanism for changing scope.
