# Operating instructions

## Source and scope control

Read `PROJECT_STATE.md`, the relevant files in `docs/project/`, then consult the legacy approved documents under `docs/00-product-overview.md` through `docs/DECISIONS.md` and implementation handoffs. Use `OPEN_ITEMS.md` for unresolved work and `LESSONS_LEARNED.md` for durable execution guidance. Treat the current validated commit and tests as repository evidence. If evidence conflicts, record the conflict and resolve it through an explicit decision; do not silently reinterpret a product rule.

Distinguish:

- bug: behavior violates an approved rule or acceptance criterion;
- requirement change: new or changed product behavior requiring decision and synchronized documentation;
- UX/UI change: presentation improvement that must not expand authorization or domain scope.

Reproduce a reported defect before implementation whenever practical. Preserve organization scope, server authorization, RLS, audit history, immutable history, and migration order.

## Engineering

Use small vertical slices, strict TypeScript, validated external input, server-only service credentials, forward-only migrations, and focused tests. Inspect related code, migration, RLS, and tests before editing. Avoid unrelated refactors and do not reset, discard, rebase, or overwrite user work.

## QA and UAT

Run targeted unit/service/SQL/RLS/Storage/authorization tests first. Add focused Playwright or manual UAT evidence for the changed acceptance boundary. Broaden regression at milestone boundaries or when focused tests expose a wider risk. Independent QA must test direct routes and manipulated requests, not only navigation. UAT uses synthetic local data and records reproducible evidence without credentials or tokens.

## Completion and reporting

Completion reports state files changed, tests and commands run, permission behavior, assumptions, unresolved risks, and remaining limitations. Do not call hosted or production work complete without hosted evidence. Production registration remains blocked while the Participation acknowledgment is provisional.

## Git and credit-efficient execution

Do not commit or push unless explicitly instructed. Keep commits small and intentional when authorized. Prefer parallel read-only inspection and targeted validation; do not rerun the entire repository suite without a risk-based reason. Never paste secrets, generated credentials, traces, or large logs into documents or reports.
