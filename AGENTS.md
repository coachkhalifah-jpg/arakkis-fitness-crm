# Fitness Event CRM — Codex Project Instructions

## Source of truth
The approved documentation is the source of truth. Before changing code, read:
1. `docs/00-product-overview.md`
2. `docs/01-personas.md`
3. `docs/02-user-journeys.md`
4. `docs/03-functional-requirements.md`
5. `docs/04-business-rules.md`
6. `docs/05-data-model.md`
7. `docs/06-permissions-matrix.md`
8. `docs/07-ui-specification.md`
9. `docs/08-mvp-scope.md`
10. `docs/09-acceptance-tests.md`
11. `docs/10-build-plan.md`
12. `docs/12-technical-design-proposal.md`
13. `docs/DECISIONS.md`

When documents conflict, stop and report the conflict instead of guessing.
The requirements freeze is recorded in `DEC-046`. Future scope changes require a new documented decision and corresponding updates to requirements, tests, and technical design.
The Participation acknowledgment remains provisional until legal approval; production is blocked until an approved version exists.

## Product boundary
Build a lightweight multi-organization fitness event booking, attendance, participant CRM, and follow-up application.

Do not add these unless a requirement is explicitly changed through a new documented decision:
- payments
- memberships or packages
- participant accounts
- automated SMS or WhatsApp
- automated waitlists
- QR check-in
- medical records
- native mobile applications
- advanced marketing automation

## Required domain distinctions
Never collapse these concepts:
- Participant primary affiliation
- Event host organization
- Physical venue
- Affiliation recorded at registration

A participant may attend events hosted by organizations other than their primary affiliation.

## Roles and authorization
- `SYSTEM_ADMIN`: global access.
- `HOST_ADMIN`: access only to assigned host organizations and their events.
- `PARTICIPANT`: public registration; no account required in MVP.

Authorization must be enforced server-side and at the database/data-access layer. Hiding navigation is not authorization.

## Registration rules
- A participant may select multiple event dates in one submission.
- Each successful selection creates a separate Registration.
- Capacity and deadlines are evaluated independently for each event.
- Partial success is required.
- Duplicate active registration for the same participant and event is prohibited.
- Participants have one global identity across venues.

## Attendance rules
- Registration statuses: `REGISTERED`, `CANCELLED`.
- Attendance outcome statuses: `NOT_RECORDED`, `ATTENDED`, `NO_SHOW`, `EXCUSED`.
- Event attendance processing states: `NOT_STARTED`, `OPEN`, `FINALIZED`, `REOPENED`.
- Finalizing attendance requires confirmation.
- Cancelled registrations never become no-shows.
- Attendance corrections must be possible for authorized admins.
- Attendance transitions are immutable and auditable.
- Cancellation before attendance opens creates no attendance records; cancellation while open preserves check-ins, uses `EXCUSED` for checked-in participants, marks unchecked active registrations `EVENT_CANCELLED`, and creates no no-shows. Standard cancellation after finalization is blocked.

## Participant indicators
Calculate from attendance history:
- First time with coach
- First time at host organization/location
- Returning participant

Do not store these as manually editable booleans.

## Follow-up rules
- First-ever attendance creates exactly one follow-up task.
- A finalized no-show creates exactly one pending no-show follow-up task.
- Trigger processing must be idempotent.
- Suggested messages are editable and copyable.
- MVP does not send messages automatically; messages are manually copied and sent.
- Only `SYSTEM_ADMIN` may access participant follow-up tasks and global follow-up history. Host Admins may see only event-operational cancellation-notification status.

## Engineering expectations
- TypeScript strict mode.
- Validate all external input.
- Use database constraints for critical invariants where practical.
- Write tests for every approved acceptance criterion, with critical criteria covered by automated tests.
- Never expose service-role credentials to the browser.
- Never commit secrets.
- Use migrations for schema changes.
- Prefer small, reviewable vertical slices.
- Run lint, type-check, and tests before reporting completion.

## Workflow
For each implementation task:
1. Restate the requirement IDs being implemented.
2. Inspect relevant files and migrations.
3. Propose a concise plan.
4. Implement the smallest complete vertical slice within the frozen MVP scope.
5. Add or update tests.
6. Run validation commands.
7. Summarize files changed, tests run, and unresolved risks.

## Code review rules
Prioritize:
- cross-organization data leakage
- capacity race conditions
- duplicate registrations
- incorrect first-time calculations
- duplicate follow-up tasks
- secrets in client-side code
- missing validation
- destructive deletion of historical records
