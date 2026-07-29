# 10 — Recommended Build Plan

Build in small vertical slices. Do not build the dashboard first.

## Phase 0 — Repository and decisions
Deliver:
- project scaffold
- environment-variable template
- lint/type-check/test commands
- database migration strategy
- CI basics
- seeded demo data plan

Codex task:
Read all docs and produce a contradiction report, architecture proposal, schema proposal, security model, and milestone plan. Do not code product features yet.

## Phase 1 — Data foundation and authentication
Deliver:
- Organization, Venue, Event
- admin profile and organization access
- Supabase Auth
- RLS/data-access policies
- seed users/organizations/events
- invite-only administrator provisioning and invitation-token lifecycle
- authorization tests

Exit criteria:
Host Admin cannot retrieve unrelated organization data.

## Phase 2 — System event administration
Deliver:
- organization and venue management
- create/edit/copy event
- status, capacity, deadline
- Public/Affiliation Restricted visibility and eligible organizations
- Event/Venue IANA timezone inheritance and override
- event cancellation request/review, permanent System Admin cancellation, audit fields, and EVENT_CANCELLED outcomes
- event list/detail

Exit criteria:
System Admin can create and publish a valid open event.

## Phase 3 — Public multi-date registration
Deliver:
- public event schedule
- multi-select dates
- participant matching/creation
- exact normalized matching and possible-duplicate routing
- versioned acknowledgments and opaque confirmation token
- Registration Group
- independent per-event transaction results
- duplicate prevention
- capacity concurrency protection
- confirmation page

Exit criteria:
AT-001 through AT-009 and AT-025/029 pass.

## Phase 4 — Calendar export
Deliver:
- Google Calendar links
- individual `.ics`
- multi-event `.ics`
- timezone correctness

Exit criteria:
AT-023 and AT-024 pass.

Phase 3 also requires AT-060–AT-062 and AT-090–AT-095 for acknowledgment lifecycle, confirmation-token controls, and DST validation.

## Phase 5 — Rosters and event operations
Deliver:
- System and Host roster views
- scoped exports
- manual registration
- walk-in
- full-capacity denial and System Admin Over-Capacity Override
- cancellation
- mobile check-in
- attendance processing states, finalization, reopening, and idempotent re-finalization
- corrections and audit metadata
- participant-notification tasks created by cancellation
- immediate HIGH-priority notification tasks, editable templates, per-Registration delivery tracking, and System Admin-only overall completion
- immutable template versions/snapshots, delivery transition history, completion gating, and Complete With Exceptions
- PENDING/APPROVED/REJECTED/WITHDRAWN cancellation request workflow
- event-scoped WhatsApp opt-in/sent status, opted-in exports, and copyable invitation messages
- exact WhatsApp export columns and explicit Mark Invitation Sent/reset/Failed workflow
- no automatic WhatsApp group addition or direct API integration

Exit criteria:
attendance, cancellation, WhatsApp scope, matching, normalization, notification workflow, and authorization acceptance tests pass, including AT-036–AT-059, AT-063–AT-073, and AT-075–AT-098.

## Phase 6 — Participant CRM
Deliver:
- System Admin participant search/profile
- event and attendance history
- first-time/returning calculations
- possible-duplicate review and System Admin-only participant merge
- host-scoped event participant view
- notes

Exit criteria:
AT-010 through AT-012, AT-021/022/028, and AT-048–AT-054 pass.

Phase 6 also includes the approved merge conflict-resolution paths covered by AT-085–AT-087.

## Phase 7 — Event Publishing, Registration Links, QR Distribution & Admin Invitations (post-MVP)

The older Phase 7 follow-up definition is superseded and absorbed into the completed Phase 6 participant CRM and follow-up milestone. This redefinition is governed by DEC-047 and does not rewrite Phase 1–6 history.

Planned deliverables:
- canonical public event registration URLs and stable safe slugs
- event publication/unpublication and public preview
- registration opening/closing and pause/resume controls
- public availability states for draft, unpublished, not-yet-open, open, paused, closed, full, cancelled, and legally blocked events
- canonical link copying without publication side effects
- high-contrast QR generation containing only the canonical URL
- System Admin invitation-link creation, private copying, expiration, revocation, regeneration, acceptance, and constrained role/organization assignment
- environment-aware local/staging/production behavior and explicit legal-readiness gating
- server-side, database-layer, RLS, audit, and cross-organization authorization controls

Phase 7 is not production authorization. It cannot begin implementation until the requirements, business rules, data model, permissions, UI specification, acceptance tests, technical/security design, traceability, and Phase 7 implementation document are synchronized.

Exit criteria:
Phase 7 acceptance scenarios AT-099–AT-132, planned database/security checks, planned unit/component checks, and planned Playwright flows pass after implementation; all Phase 1–6 regressions remain green; the production legal gate remains active.

## Phase 8 — Dashboards, polish, and later product work
Deliver:
- System dashboard
- Host dashboard
- loading/error/empty states
- responsive design
- accessibility pass
- production seed/setup documentation

Exit criteria:
all MVP acceptance tests pass and no parallel spreadsheet is needed for a test event.

## Phase 9 — Deployment readiness (separate future activity)
Deliver:
- Vercel deployment
- Supabase production project
- environment secrets
- custom domain readiness
- backup/export procedure
- monitoring/logging basics
- privacy notice and operational runbook
- event cancellation and WhatsApp invitation operating procedures
- acknowledgment legal-status gate and deployment block for PROVISIONAL participation text
- final verification of AT-060–AT-062, AT-090–AT-095, and the production legal gate

## Definition of done for every phase
- Requirement IDs cited in implementation summary
- Migrations included
- Tests added
- lint passes
- type-check passes
- automated tests pass
- no secrets committed
- security implications reviewed
- manual test steps documented
- Git checkpoint/commit created
