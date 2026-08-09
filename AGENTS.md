# Arakkis Codex project instructions

## Canonical source

Before any task, read `docs/project/PROJECT_STATE.md`, the relevant files in `docs/project/`, and `docs/project/OPEN_ITEMS.md`. Use `PRODUCT_RULES.md`, `ROLE_PERMISSION_MATRIX.md`, `ARCHITECTURE_BASELINE.md`, `TESTING_STRATEGY.md`, and `LESSONS_LEARNED.md` as the operating baseline. Consult the legacy approved requirements (`docs/00-product-overview.md` through `docs/DECISIONS.md`) and implementation handoffs as repository evidence. When sources conflict, report the conflict and do not guess; requirement changes need an explicit decision and synchronized documentation/tests.

## Guardrails

- Preserve the approved product boundary, Organization/Venue/Event distinctions, server authorization, RLS, audit/history, legal gate, and migration integrity.
- Distinguish bugs from requirement, UX, UI, copy, security, and test changes.
- Reproduce defects before implementation and make the smallest complete change.
- Never expose service-role credentials; never commit secrets or local generated credentials.
- Do not add excluded features without an approved decision.
- Run targeted tests before broader regression; do not expand QA scope circularly.
- Avoid unrelated edits and preserve existing user work.

## Workflow and reporting

Inspect relevant code, migrations, actions, RLS, and tests; state the requirement and plan; implement; validate; and report files changed, tests run, assumptions, unresolved risks, and remaining limitations. Do not commit or push unless the user explicitly instructs it. Production registration remains blocked until the Participation acknowledgment is legally approved.
