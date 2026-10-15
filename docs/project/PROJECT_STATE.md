# Arakkis project state

## Current position

- Project: Arakkis
- Release stage: Pilot / pre-production
- Validated application baseline: `28b63d68b58a0a310e1811d6b29e88da745790af`
- Product candidate SHA (DEC-058): `f52da3f89cc64faf0d97ef20035aa14b5796624f`
- Branch: `codex/mvp-free-tier-deployment`
- Tip (post pilot UAT batch): `14da01a`
- Hosted migrations applied through: **0080** (`public_event_schedule` per-weekday hub — DEC-068)
- Remote: `coachkhalifah-jpg/arakkis-fitness-crm`
- Current milestone: pilot UAT batch complete; next Eng stream is isolated take-home workout timers (migration **0081**, superseding draft #33 numbering).

## Validated

Event creation, recurring Events, draft/publish flow, Event images and replacement cleanup, Admin Workspace navigation/authorization, public registration, attendance, participant CRM/follow-up, publishing/invitations, and focused local QA are implemented or locally validated as documented in `CURRENT_ROADMAP.md`.

Pilot hosted UAT (2026-10-15 window) closed PASS for: People chrome / Goals / about-you, schedule + series image, remember hide, already-booked, Before you arrive, confirmation affirmation copy, DEC-065 materialize, People EDIT CONTACT/Goals IA, and DEC-068 hub weekday cards (after 0080).

## Current focus

Take-home workout timer surface (admin CSV import + public `/workouts/[slug]`), migration **0081**, isolated from Events/registration. HOLD UAT-004/005/007 remain parked unless Product Owner reopens.

## Next

1. Land timer track (0081) + Coach smoke.
2. Owner-controlled staging validation continues: Auth, backups/PITR, monitoring, domain, legal-gate verification.
3. Shared UI/UX design-system initiative remains a separate product-improvement stream.

## Blockers and limitations

Production registration is blocked by the provisional Participation acknowledgment. Hosted Auth configuration, domain setup, monitoring, backup/PITR confirmation, restore rehearsal, and rollback rehearsal remain incomplete. Local Playwright uses a shared synthetic database and one worker.

Last Product Owner/QA-approved milestone: the validated J5 baseline at `28b63d6`.
Product candidate tip accepted: `f52da3f` (DEC-058).
Pilot UAT batch tip accepted for ongoing Eng: `14da01a` (+ hosted 0080).

See [`CURRENT_ROADMAP.md`](CURRENT_ROADMAP.md) and [`OPEN_ITEMS.md`](OPEN_ITEMS.md).
