# Arakkis project state

## Current position

- Project: Arakkis
- Release stage: Pilot / pre-production
- Validated application baseline: `28b63d68b58a0a310e1811d6b29e88da745790af`
- Branch: `codex/mvp-free-tier-deployment`
- Remote: `coachkhalifah-jpg/arakkis-fitness-crm`
- Current milestone: validated J5 Event workflow baseline and operating-document preparation.

## Validated

Event creation, recurring Events, draft/publish flow, Event images and replacement cleanup, Admin Workspace navigation/authorization, public registration, attendance, participant CRM/follow-up, publishing/invitations, and focused local QA are implemented or locally validated as documented in `CURRENT_ROADMAP.md`.

## Current focus

Finish the canonical operating documentation and resolve documentation drift around the validated assigned-Organization Host Admin Venue model. No application change is in progress.

## Next

Product Owner review of the canonical documents, then owner-controlled staging validation: migration replay, Auth, backups, monitoring, UAT, and legal-gate verification.

## Blockers and limitations

Production registration is blocked by the provisional Participation acknowledgment. Hosted deployment, backup/restore rehearsal, monitoring, domain, and hosted Auth evidence remain pending. Local Playwright uses a shared synthetic database and one worker.

Last Product Owner/QA-approved milestone: the validated J5 baseline at `28b63d6`.

See [`CURRENT_ROADMAP.md`](CURRENT_ROADMAP.md) and [`OPEN_ITEMS.md`](OPEN_ITEMS.md).
