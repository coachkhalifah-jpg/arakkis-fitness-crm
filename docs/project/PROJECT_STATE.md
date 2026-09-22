# Arakkis project state

## Current position

- Project: Arakkis
- Release stage: Pilot / pre-production
- Validated application baseline: `28b63d68b58a0a310e1811d6b29e88da745790af`
- Product candidate SHA (DEC-058): `f52da3f89cc64faf0d97ef20035aa14b5796624f`
- Branch: `codex/mvp-free-tier-deployment` (narrow calm-recovery hardening)
- Remote: `coachkhalifah-jpg/arakkis-fitness-crm`
- Current milestone: calm recovery UX + remember encouragement on the product candidate SHA; no re-architecture.

## Validated

Event creation, recurring Events, draft/publish flow, Event images and replacement cleanup, Admin Workspace navigation/authorization, public registration, attendance, participant CRM/follow-up, publishing/invitations, and focused local QA are implemented or locally validated as documented in `CURRENT_ROADMAP.md`.

## Current focus

DEC-058 calm recovery on candidate tip `f52da3f`: preserve existing public UI patterns while improving disconnected/expired/already-registered and remember-device guidance. Narrow engineering and QA only.

## Next

Owner-controlled candidate deploy (apply migration 0072) + smoke QA, then staging validation: migration replay, Auth, backups, monitoring, UAT, and legal-gate verification.

## Blockers and limitations

Production registration is blocked by the provisional Participation acknowledgment. Hosted deployment, backup/restore rehearsal, monitoring, domain, and hosted Auth evidence remain pending. Local Playwright uses a shared synthetic database and one worker.

Last Product Owner/QA-approved milestone: the validated J5 baseline at `28b63d6`.
Product candidate tip accepted: `f52da3f` (DEC-058).

See [`CURRENT_ROADMAP.md`](CURRENT_ROADMAP.md) and [`OPEN_ITEMS.md`](OPEN_ITEMS.md).
