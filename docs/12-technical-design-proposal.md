# Fitness Event CRM — Technical Design Proposal

## 1. Scope and executive summary

This is a requirements review and implementation plan only. It does not create application code or expand the product boundary. It is based on AGENTS.md, README.md, every file in docs/, and docs/DECISIONS.md.

Recommended MVP: Next.js App Router, strict TypeScript, shadcn/ui with Tailwind CSS, Supabase PostgreSQL/Auth/RLS, and Vercel. Public registration should use validated server actions/route handlers and database transactions/RPCs for capacity-safe writes. Administration should use Supabase Auth plus defense-in-depth server authorization and RLS.

The central model is:

~~~
Participant (global identity)
  └─ RegistrationGroup (one submission)
       └─ Registration (one participant/event reservation)
            └─ Attendance (one outcome)

Event ── hosted by ── Organization
Event ── occurs at ── Venue
Registration ── records ── affiliation at registration time
Host Admin ── assigned to ── Organization(s)
EventCancellation ── creates ── ParticipantNotificationTask(s)
Event ── optionally provides ── WhatsApp invitation link
~~~

The highest-risk areas are capacity races, conservative participant matching, host-organization authorization, attendance/follow-up idempotency, and timezone correctness.

## 2. Traceability summary

### Personas to journeys

| Persona | Primary journeys | Outcome |
|---|---|---|
| Participant | J1 multi-date registration; J6 cross-location participation | Mobile registration without an account, independent results, calendar export, one global identity |
| Coach / System Admin | J2 event preparation; J4 attendance; J5 follow-up; J6 cross-location participation | Global event, participant, attendance, and follow-up operations |
| Host Admin | J3 host preparation; J4 attendance; J6 cross-location participation | Event-day operations limited to assigned host organizations |

### Journey-to-requirement traceability

| Journey | Functional requirements | Business rules | Entities | Permissions | Acceptance tests |
|---|---|---|---|---|---|
| J1 Participant registration | FR-006–FR-014, FR-030 | BR-001–BR-020, BR-052 | Event, Organization, Venue, Participant, RegistrationGroup, Registration | Public reads open events and submits registration only | AT-001–AT-009, AT-023–AT-025, AT-029 |
| J2 Coach preparation | FR-001–FR-005, FR-018, FR-027–FR-032, FR-039, FR-041–FR-044 | BR-041–BR-048, BR-049–BR-051 | AdminUser, access assignments, Event, Registration, Attendance, ParticipantNote | System Admin global; Host Admin scoped | AT-008, AT-017–AT-020, AT-026, AT-030 |
| J3 Host preparation | FR-018, FR-024, FR-032–FR-033, FR-040–FR-041 | BR-018, BR-042–BR-047 | AdminUser, assignments, Event, Registration, Participant, Attendance | Scope derives from event host, never participant affiliation | AT-017–AT-020, AT-022, AT-026 |
| J4 Check-in/finalization | FR-015–FR-021 | BR-022–BR-029 | Registration, Attendance, Event, AuditLog | Authorized System/assigned Host Admin only | AT-013, AT-014, AT-027 |
| J5 Follow-up | FR-025, FR-034–FR-038 | BR-030–BR-040 | Attendance, FollowUpTask, Event, Participant | Global queue System Admin-only by default | AT-010–AT-012, AT-015–AT-016, AT-027 |
| J6 Cross-location | FR-022–FR-026, FR-030, FR-032–FR-033 | BR-012, BR-015–BR-019, BR-041–BR-048 | Participant, Organization, Venue, Event, Registration, Attendance, Note | System Admin global; Host Admin host-specific | AT-009, AT-011, AT-021–AT-022, AT-028 |
| J7 Event cancellation | FR-045–FR-047, FR-063–FR-065 | BR-056–BR-063, BR-089–BR-093 | Event, EventCancellationRequest, EventCancellation, Registration, ParticipantNotificationTask/Delivery, AuditLog | System Admin direct action; Host Admin request/status updates only for assigned events | AT-036–AT-040, AT-045–AT-047, AT-063–AT-068 |
| J8 Optional WhatsApp group | FR-048–FR-050, FR-066–FR-068 | BR-064–BR-069, BR-094–BR-096 | Event, Registration, Participant, scoped export/status | Optional per-Registration opt-in; System Admin link management; assigned-event admin export/status | AT-041–AT-044, AT-069–AT-073 |

### Requirement-area coverage

| Area | IDs | Design implication |
|---|---|---|
| Event lifecycle | FR-001–FR-005, FR-045–FR-047 | Status, capacity, timezone, permanent cancellation/rescheduling, host/venue FKs, archive preservation |
| Public registration | FR-006–FR-017, FR-051–FR-053, FR-060–FR-061 | Narrow public projection, exact normalized matching, versioned acknowledgment evidence, tokenized results |
| Attendance | FR-018–FR-021, FR-056–FR-058 | Separate registration/attendance state, lifecycle/reopening, confirmation-gated finalization, audit, timezone correctness |
| Participant CRM | FR-022–FR-027, FR-051–FR-055 | Global identity, possible duplicates/merges, attendance-derived indicators, scoped host projections |
| Organizations/access | FR-028–FR-033 | Reusable organizations/venues, assignments, server/RLS enforcement |
| Follow-up | FR-034–FR-038 | Unique trigger key, idempotent First Attendance and finalized No-Show tasks, manual messages |
| Dashboards/exports | FR-039–FR-041 | Scope-preserving queries and CSV generation |
| Authentication/admin | FR-042–FR-044, FR-059 | Supabase Auth, invite-only role lifecycle, archive/deactivate |
| Legal/consent | FR-008, FR-060, FR-062 | Immutable acknowledgment versions, acceptance evidence, production legal gate |
| Cancellation/WhatsApp | FR-045–FR-050, FR-063–FR-068 | Permanent audited cancellation workflow, immediate idempotent notification tasks/delivery tracking, exact consented invite-link exports |

## 3. Approved decisions and implementation notes

The following decisions are now approved and incorporated. No ambiguity from the attached decision set remains unresolved.

1. **Approved — no-show follow-up:** each finalized No-Show creates exactly one pending task. Task creation is idempotent; messages are manually copied and sent, and attendance correction reassesses the task.
2. **Approved — capacity reduction:** capacity cannot be saved below active registrations; validation rejects the change and never cancels registrations.
3. **Approved — indicator timing:** compare only prior ATTENDED records from Events starting before the current Event; equal timestamps are not prior, and the current Event becomes history only after finalization.
4. **Approved — participant matching:** automatic match requires normalized E.164 phone plus normalized first and last name. Ambiguous/conflicting matches become possible-duplicate cases; only System Admin may merge with full history/audit migration and duplicate archival.
5. **Approved — normalization:** use a libphonenumber-compatible parser with United States (+1) default and country selection; store display/original, E.164, and country. Trim/lowercase email for comparison without provider transformations; email is not an auto-merge key.
6. **Approved — Host Admin event scope:** Host Admin handles rosters, registrations, walk-ins, check-in, finalization, and corrections for assigned events only; core event details remain System Admin-only.
7. **Approved — follow-up access:** only System Admin may view/edit/copy/complete/dismiss participant follow-up tasks or global history; Host Admin sees only event-operational cancellation-notification status.
8. **Approved — walk-in capacity:** Host Admin is blocked at full capacity; System Admin may use a recorded Over-Capacity Override with warning, reason, confirmation, identity, timestamp, and capacity/result counts.
9. **Approved — attendance lifecycle:** states are NOT_STARTED, OPEN, FINALIZED, REOPENED. Authorized admins open/finalize/correct; only System Admin reopens with reason/audit and safe re-finalization.
10. **Approved — timezone/DST:** store UTC instants plus Event IANA timezone, inherited from Venue with System Admin override; use it for display, deadlines, exports; default Venue timezone is America/New_York.
11. **Approved — admin provisioning:** no public signup; securely provision initial System Admin; invite Host Admins by required email/assignment with hashed single-use 72-hour tokens and no production default passwords.
12. **Approved — acknowledgment/token security:** immutable versioned acknowledgments retain exact acceptance evidence; confirmation tokens are 256-bit opaque SHA-256-hashed tokens, scoped to one group, read-only, and expire after 24 hours.
13. **Approved — event cancellation:** only System Admin directly cancels; Host Admin submits assigned-event requests. Cancellation is permanent in MVP, requires reason/type/confirmation, preserves history, blocks registration/check-in/finalization/no-shows, records audit metadata and affected count, creates idempotent notification tasks, and uses EVENT_CANCELLED outcomes. Rescheduling copies a separate Draft Event with no transferred registrations/attendance.
14. **Approved — cancellation notifications:** tasks are immediate, HIGH priority, due at cancellation time, use immutable versioned templates, track per-Registration manual delivery, enforce the approved delivery state machine, and require System Admin overall completion/dismissal while assigned Host Admins may update individual statuses.
15. **Approved — cancellation requests:** PENDING/APPROVED/REJECTED/WITHDRAWN; assigned Host Admin may withdraw pending requests, System Admin alone approves/rejects, rejection requires a reason, and all decisions are audited.
16. **Approved — WhatsApp export/workflow:** exact approved columns/exclusions apply; selected authorized active opted-in Registrations are the default scope, explicit filters include cancelled outcomes, and copy/export never marks SENT.
17. **Approved — WhatsApp opt-in:** opt-in, timestamp, and disclosure version are stored per Registration and never carried across Events.
18. **Approved — delivery state machine:** only the documented per-recipient transitions are permitted; normal task completion requires all affected active Registrations to be terminal, while System Admin Complete With Exceptions requires a reason and audit evidence.
19. **Approved — template history:** template versions and rendered cancellation messages are immutable; replacement links use only published canonical public URLs.
20. **Approved — cancellation transaction:** one pending request per Event, no material edits while pending, and atomic idempotent approval.
21. **Approved — merge conflicts:** System Admin selects the survivor and explicit contact/affiliation/attendance conflict resolutions; all historical records are retained and the source is archived.
22. **Approved — invitation activation:** Auth linking and organization-assignment activation are transactional; invitees cannot alter assignments and unassigned Host Admins are suspended.
23. **Approved — acknowledgment lifecycle:** only APPROVED versions are production-usable; historical evidence remains immutable through retirement or revocation.
24. **Approved — confirmation tokens:** one active token per group, revocation on regeneration, access metadata, generic invalid responses, and configurable abuse limits.
25. **Approved — DST input:** reject nonexistent local times and disambiguate duplicated local times before storing UTC.
26. **Approved — override/attendance audit:** Over-Capacity Overrides and attendance transitions are dedicated immutable records; cancellation behavior depends on attendance processing state and finalized attendance is not silently rewritten.

## 4. Security, concurrency, and privacy review

### Security risks and controls

| Risk | Control |
|---|---|
| Host Admin guesses another event URL/API | RLS and server checks require assignment matching event host; unauthorized objects use not-found semantics |
| Service-role key reaches browser | Keep it in server-only modules and inspect build output |
| Public overposting | Zod schemas whitelist fields; public input cannot set role, status, capacity, ownership, or attendance |
| Participant enumeration | Opaque IDs/tokens, narrow public projections, rate limiting, generic errors, no public lookup |
| CSV leakage | Export server-side from the same scoped query as the roster |
| Unauthorized role changes | System Admin-only mutations, constraints, audit log, no client-controlled role |
| Historical deletion | Archive flags and restricted deletes; preserve registration/attendance/audit rows |
| PII in logs | Redact phone/email/form payloads; log IDs/request IDs only; never log secrets |

### Concurrency controls

1. Capacity must be checked at final write time in a PostgreSQL transaction/RPC that locks the event row, re-counts active registrations, and inserts only while capacity remains.
2. Enforce a partial unique index on active participant/event registrations; map conflicts to Already Registered.
3. Use conditional updates and retry-safe commands for cancellation, check-in, and finalization.
4. Use unique semantic follow-up trigger keys, such as first-attendance:{participant_id} and no-show:{registration_id}, with conflict-safe insertion.
5. Make participant lookup/creation transactional; do not make phone globally unique because shared household phones are allowed.
6. Lock event rows for both capacity edits and registration writes.

### Privacy controls

- Collect only required name, mobile, affiliation, and acknowledgement; keep email, experience, and notes optional.
- Host Admins receive event-operational contact data and host-specific history only. Notes and cross-organization history are System Admin-only.
- No public participant search/profile. Confirmation tokens are narrow, expiring, and non-enumerable.
- Before production, document notice, purpose, access, retention, and archive/deletion policy.
- Do not add medical records, payments, memberships, participant accounts, automated messaging, or other explicit non-goals.

## 5. Recommended MVP stack

- Next.js App Router with strict TypeScript; Server Components for reads and Server Actions/route handlers for validated mutations.
- Tailwind CSS and shadcn/ui with accessible status components and mobile-first public/check-in flows.
- Supabase PostgreSQL/Auth. PostgreSQL owns constraints, transactions, indexes, audit records, and scoped views/functions.
- PostgreSQL RLS plus explicit server/data-access authorization. UI hiding is not authorization.
- Vercel for Next.js and separate Supabase development/staging/production projects.
- Zod at every external boundary; server-side phone/email normalization.
- Vitest, React Testing Library, Playwright, and PostgreSQL/RLS integration tests.
- Server-generated RFC 5545 ICS, Google Calendar URLs, and scoped CSV from canonical serializers.

No requested stack deviation is needed. Supporting libraries for validation, time, CSV, ICS, and testing should be selected and pinned in Phase 0.

## 6. Proposed repository structure

~~~
app/
  (public)/events/...
  (admin)/dashboard/...
  (admin)/events/[eventId]/...
  (admin)/participants/...
  (admin)/follow-ups/...
  api/...
components/ui/                 # shadcn/ui
components/public/             # registration/calendar UI
components/admin/              # roster/check-in/dashboard UI
lib/auth/                      # session and role helpers
lib/db/                        # Supabase clients/data access
lib/domain/                    # pure rules and indicators
lib/validation/                # Zod schemas
lib/calendar/                 # ICS/Google serializers
lib/exports/                   # scoped CSV serializers
supabase/migrations/
supabase/seed.sql
supabase/tests/
tests/unit/
tests/integration/
tests/e2e/
docs/
~~~

Keep authorization checks close to each data-access function. Do not make generic browser-side Supabase queries the only enforcement path.

## 7. Logical and physical database schema

### Physical table proposal

| Table | Important columns and constraints |
|---|---|
| organizations | id, name, category, address, active/archive fields; unique normalized name among active rows |
| venues | id, optional organization_id, name/address, IANA timezone defaulting to America/New_York, active/archive fields |
| admin_profiles | id = Auth user id, display_name, required email, role, status, timestamps; no public signup or participant accounts |
| admin_invitations | invitee email, role, PENDING/ACCEPTED/REVOKED/EXPIRED/REPLACED status, hashed single-use 72-hour token, accepted Auth user/admin profile FK, lifecycle timestamps |
| admin_invitation_organizations | invitation_id, organization_id, created_at; immutable during pending acceptance and copied transactionally to admin_organization_access |
| admin_organization_access | admin_user_id, organization_id, created_by, timestamps; unique pair |
| events | name, host_organization_id, venue_id, starts_at, ends_at, timezone, positive capacity, deadline, status, visibility, eligible organizations, attendance_processing_state (NOT_STARTED/OPEN/FINALIZED/REOPENED), optional WhatsApp invite URL/message, cancellation/archive fields, creator; check end > start |
| participants | original/display names plus normalized first/last names, normalized/display phone, phone country, normalized/display email, nullable primary affiliation, secondary/historical contacts, other text, optional experience, status/archive/timestamps; no unique phone |
| possible_duplicate_cases | candidate participants, source, matching signals/normalized values, OPEN/MERGED/DISMISSED status, reviewer/audit fields |
| participant_merges | survivor, archived duplicate, actor/time, migrated counts, notes; immutable merge audit |
| registration_groups | participant, source enum, separate acknowledgment acceptance links/evidence, hashed 256-bit confirmation token, issued/expiry/revocation/access metadata, submitted_at, optional admin creator, idempotency key; one active token |
| registrations | group/participant/event FKs, historical affiliation FK/text, status, registration outcome including EVENT_CANCELLED, registered/cancelled timestamps/reason, per-Registration WhatsApp opt-in/timestamp/disclosure version/status, optional admin creator; partial unique active participant/event |
| attendance | unique registration_id, status, check-in/finalized timestamps, updater; cancelled-event registrations cannot finalize or become No-Show |
| event_eligible_organizations | event_id, organization_id; unique pair for affiliation-restricted events |
| event_cancellation_requests | event, requesting/reviewing admins, reason, urgency, proposed replacement date, type, PENDING/APPROVED/REJECTED/WITHDRAWN status, review/withdrawal fields; Host Admin requests are assigned-event scoped |
| event_cancellations | event, cancelling admin, reason, type, confirmed timestamp, active-registration count, template-version FK, rendered-message snapshot, administrator edits, optional published replacement-event FK; cancellation is permanent in MVP |
| participant_notification_tasks | participant/event, EVENT_CANCELLED type, HIGH priority, event-start snapshot, template version, suggested message, created/due/completion fields; unique participant/event/type |
| participant_notification_deliveries | notification task, affected registration, NOT_REQUIRED/PENDING/SENT/FAILED/DECLINED status, WHATSAPP/SMS/EMAIL/PHONE/OTHER channel, sent time/admin, delivery note; unique task/registration pair; manual SENT only |
| notification_delivery_transitions | delivery, previous/new status, actor, time, channel, optional note; immutable |
| cancellation_template_versions | type, version, exact text, status, creator, created/retired timestamps; immutable |
| acknowledgment_versions | type, version, exact text, hash, effective/retired timestamps, DRAFT/PROVISIONAL/APPROVED/RETIRED/REVOKED legal status; immutable |
| acknowledgment_acceptances | participant, registration group, exact version, timestamp, method, IP, user agent; immutable |
| confirmation_token_access | registration group, token hash, issued/expiry/revocation/access timestamps, access count; one active token per group |
| over_capacity_overrides | event, resulting registration, approving System Admin, reason, capacity/counts before/after, timestamp, source; immutable |
| attendance_transitions | attendance, from/to status, actor, timestamp, reason, source; immutable |
| completed_event_invalidations | finalized event, requesting/confirming System Admins, reason, confirmation time, audit reference; does not rewrite attendance history |
| follow_up_tasks | participant, optional event, reason, trigger_key, due/status, suggested message, completion fields; unique automated trigger key |
| participant_notes | participant, note, creator, visibility System Admin-only, timestamps/archive |
| audit_log | actor, action, entity type/id, old/new values, reason, timestamp, request ID; append-only |

Indexes: event status/deadline/start, registrations by event/status and participant/event, normalized phone/email, attendance by participant/status, follow-up status/due, and assignments by admin/organization.

### Critical invariants

~~~
create unique index registrations_one_active_per_event
  on registrations (participant_id, event_id)
  where registration_status = 'REGISTERED';

create unique index follow_up_one_automated_trigger
  on follow_up_tasks (trigger_key)
  where trigger_key is not null;

alter table attendance
  add constraint attendance_one_per_registration unique (registration_id);

create unique index cancellation_notification_once
  on participant_notification_tasks (participant_id, event_id, notification_type);

create unique index admin_invitation_token_once
  on admin_invitations (token_hash);

create unique index notification_delivery_once
  on participant_notification_deliveries (participant_notification_task_id, registration_id);

create unique index one_pending_cancellation_request
  on event_cancellation_requests (event_id)
  where status = 'PENDING';

create unique index one_active_confirmation_token
  on confirmation_token_access (registration_group_id)
  where revoked_at is null;

create unique index one_over_capacity_override_per_registration
  on over_capacity_overrides (registration_id);
~~~

Capacity is a transaction invariant, not a check constraint. Expose a narrowly scoped register_selected_events RPC that validates each event and performs capacity-safe writes. Do not grant public arbitrary registration inserts. Cancellation approval uses one transaction that locks the Event and request, validates state, applies all outcomes, creates tasks/deliveries, and writes audit records. Attendance and notification transitions use conditional updates plus immutable transition inserts. Enforce registration-outcome/event-state and acknowledgment-status checks in database constraints or security-definer functions.

### Derived indicators

Never persist first-time/returning booleans. Calculate from finalized ATTENDED records before the current event:

- first_with_coach: no prior ATTENDED event whose starts_at is before the current Event.
- first_at_host: no prior ATTENDED event for the current host whose starts_at is before the current Event.
- returning: at least one prior ATTENDED event whose starts_at is before the current Event.
- equal start timestamps are not prior; the current Event becomes history only after finalization.

Use the same parameterized query/function for rosters and dashboards. Host projections apply authorization scope before returning history or aggregates.

## 8. Migration sequence

1. Add extensions/types, timestamp helpers, and status/archive conventions.
2. Create organizations and venues.
3. Create admin profiles and organization access, plus Auth lookup helpers.
4. Create events and lifecycle checks/indexes.
5. Create participants and normalized search indexes.
6. Create registration groups and registrations, historical affiliation, and the partial unique active index.
7. Create attendance and its one-to-one constraint.
8. Create follow-up tasks and trigger-key uniqueness for First Attendance and finalized No-Show triggers.
9. Create event eligibility, cancellation requests/records, participant-notification tasks/deliveries, registration outcomes, and attendance processing states.
10. Add event WhatsApp invite fields, registration opt-in/sent fields, and scoped export projections.
11. Add possible-duplicate cases, participant merges, and merge audit records.
12. Add administrator invitations and hashed token lifecycle.
13. Add immutable acknowledgment versions/acceptances and confirmation-token hashes/expiry.
14. Create participant notes and append-only audit log.
15. Add RLS policies and security-definer helpers with fixed search paths and narrow grants.
16. Add scoped views/RPCs for public events, registration, roster, cancellation, indicators, dashboards, duplicate review, and exports.
17. Add deterministic local seed data and test identities.
18. Add cancellation template versions, delivery-transition history, and task-completion guards.
19. Add confirmation-token access metadata/rate-limit logging and acknowledgment legal-status checks.
20. Add invitation acceptance linkage/assignment activation, merge conflict records, Over-Capacity Overrides, attendance transitions, and DST validation helpers.
21. Add exceptional completed-event invalidation records and authorization checks.

Migrations are forward-only and reviewable. Historical backfills require an explicit plan and tests.

## 9. RLS and authorization strategy

1. Enable RLS on every application table.
2. Derive role from auth.uid() and admin_profiles; never trust client role claims.
3. Define reviewed is_system_admin() and has_host_access(organization_id) helpers with fixed search_path and restricted execution.
4. Derive host scope through registrations.event_id → events.host_organization_id; participant affiliation never grants Host Admin access.
5. System Admin has required global access, including direct permanent cancellation and WhatsApp-link management. Host Admin gets assigned organization/event access, event-operational participant projections, cancellation requests, individual notification-delivery updates, and opted-in WhatsApp exports. Public gets only open/upcoming event projection and approved registration RPC with optional per-Registration WhatsApp opt-in.
6. Deny public reads of participants, registrations, attendance, notes, admin profiles, assignments, possible-duplicate cases, merges, invitations, acknowledgments, and audits. Public confirmation access requires a valid scoped token and returns only its submission results/calendar links.
7. Server data-access functions perform explicit authorization checks in addition to RLS.
8. Return generic not-found/denial responses for unauthorized IDs.
9. Test unauthenticated, System Admin, ABC Host Admin, and XYZ Host Admin against direct object, aggregate, export, merge, follow-up, invitation, and confirmation-token access.
10. Keep the service-role client server-only and use it only in narrowly justified, explicitly authorized workflows.
11. Enforce notification delivery transitions, completion gating, invitation activation, merge actions, token regeneration, and exceptional attendance invalidation through server-side transactions/RPCs; RLS alone is not sufficient for these state machines.

## 10. Testing strategy

### Unit

Test validation/normalization, conservative participant matching, duplicate review/merge, event eligibility, attendance transitions/reopening, indicator timing, follow-up due dates/keys, administrator invitation tokens, acknowledgment version resolution, confirmation tokens, and ICS/Google Calendar serialization including timezone/DST.

### Database/integration

Test foreign keys/status checks/archive behavior, active-registration uniqueness, capacity-safe concurrency, cancellation capacity release, partial-success semantics, idempotent task creation, notification delivery transitions/completion gating, atomic cancellation rollback and retry, merge conflict resolution, invitation activation, acknowledgment legal statuses, token abuse limits, Over-Capacity Override persistence, attendance transitions/cancellation by processing state, exact export projections, and RLS cross-organization isolation.

### End-to-end

Translate AT-001–AT-098 into Playwright journeys with isolated seeded data and stable test users. Prioritize AT-006, AT-012, AT-016, AT-018, AT-019, AT-022, AT-026, AT-027, AT-029, AT-036–AT-044, AT-048–AT-074, and AT-075–AT-098.

### Quality gates

Every phase runs lint, strict type-check, unit/integration tests, relevant E2E tests, migration validation, and a secrets scan. Add manual mobile, keyboard accessibility, export, and loading/error/empty-state checks.

## 11. Phased implementation plan

1. **Phase 0 — repository and decisions:** scaffold, environment template, scripts, migration/test harness, CI, seed plan, decision record, legal-gate check, and this proposal.
2. **Phase 1 — data foundation/auth:** organizations, venues, events, admin profiles/assignments, invite-only administrator provisioning, Auth, RLS, seed data, authorization tests.
3. **Phase 2 — event administration:** System Admin organization/venue management, event create/edit/copy, lifecycle, capacity/deadline, public URL.
4. **Phase 3 — public registration:** schedule, multi-date form, exact normalization/matching, possible-duplicate routing, versioned acknowledgments, opaque confirmation token, registration group, independent results, duplicate/race protection, confirmation.
5. **Phase 4 — calendar export:** individual/all-event ICS and Google Calendar links with timezone correctness.
6. **Phase 5 — rosters/event operations:** scoped rosters/exports, manual registration, walk-ins/over-capacity override, cancellation, attendance lifecycle/reopening, check-in, finalization, corrections, audit, WhatsApp opt-in/status/export/message, notification delivery state machine, and cancellation transaction handling.
7. **Phase 6 — participant CRM:** System Admin search/profile, possible-duplicate review/merge, global history, timestamp-relative indicators, host-scoped views, notes.
8. **Phase 7 — event publishing and distribution (post-MVP, DEC-047):** canonical event URLs, safe slugs, publication and availability controls, link copy/preview, QR generation, and System Admin invitation-link lifecycle; no automated sending.
9. **Phase 8 — dashboards/polish and later work:** dashboards, responsive/accessibility pass, loading/error/empty states, and operational documentation.
10. **Phase 9 — deployment readiness:** Vercel/Supabase production setup, secrets, backups/exports, monitoring/logging, privacy notice, invitation runbook, legal acknowledgment gate, production deployment block for PROVISIONAL status, token abuse controls, and DST/attendance operational runbooks.

Do not pull participant self-cancellation, automated email, waitlists, configurable no-show triggers, direct WhatsApp Groups API integration, or richer analytics into MVP. DEC-049 separately approves the narrow weekly, materialized recurrence extension with a 14-day selection window; arbitrary recurrence rules remain deferred.

DEC-050 also approves a nullable HTTPS communication URL/label on Event, returned
only by the successful confirmation projection, plus typed centralized public
branding and replaceable static background assets. The implementation must keep
the URL server-validated and must not expose it on public pre-registration or
failed confirmation responses.

Phase 7 is a post-MVP extension and does not authorize production deployment or legal approval. Its detailed canonical URL, slug, QR, invitation, environment, legal-gate, migration, RLS, audit, and validation design is documented in `docs/22-phase-7-publishing-links-invitations-implementation.md`. The approved recurrence and pilot UX extensions are documented by DEC-049/DEC-050 and the current pilot guide.

The original traceability tables in this frozen-MVP proposal cover FR-001–FR-086, BR-001–BR-112, and AT-001–AT-098. DEC-047 adds the synchronized post-MVP Phase 7 range FR-087–FR-105, BR-113–BR-136, and AT-099–AT-132; the Phase 7 implementation document is the authoritative extension traceability matrix.

## 12. Local-development prerequisites

- Pinned Node.js/runtime and package-manager lockfile.
- Supabase CLI and Docker, or a documented remote development project.
- .env.example with browser-safe Supabase settings and server-only placeholders; no real secrets.
- Local migration/reset/seed commands.
- Seeded System Admin and two Host Admin identities assigned to different organizations.
- Unit, integration, and Playwright runners plus lint/type-check from a clean checkout.
- Configured default phone country and IANA timezone fixtures.
- Local-only Auth invitation/test-email behavior if needed; no participant messaging.

## 13. Proposed Phase 0 pull request

The first reviewable PR should contain only repository and decision foundations:

1. Add the Next.js/TypeScript/Tailwind/shadcn baseline with strict TypeScript and a minimal shell, not product features.
2. Pin runtime/package-manager versions and add dev, build, lint, typecheck, test, test:e2e, migration, reset, and seed scripts.
3. Add .env.example with no real values.
4. Add Supabase migration framework and base/no-op migration plus local seed conventions; defer product tables unless explicitly approved as schema foundation.
5. Add unit, database/integration, and Playwright harnesses with smoke tests where feasible.
6. Add CI for lockfile install, lint, type-check, tests, migration validation, and secrets scanning.
7. Keep each Phase 0 pull request limited to the documentation changes directly required for its approved scope; this proposal and the approved requirement documents are the source of truth.
8. Treat the approved decisions in Section 3 as MVP requirements; do not silently add participant accounts or other out-of-scope features.
9. Define local-only ABC/XYZ organizations, venues, events, System Admin, and separate Host Admin assignments; never use seed credentials in production.
10. Review AT-006, AT-018, AT-019, AT-022, AT-027, and AT-029 implications before Phase 1.

## 14. Traceability index

| Design section | Primary source coverage |
|---|---|
| Scope/model | Product overview, personas, J1/J6, FR-022/030, BR-012/015/019, DEC-002–004 |
| Traceability | Personas, journeys, FR-001–086, BR-001–112, data model, permissions, AT-001–098 |
| Decisions | FR-005, FR-015/038, FR-016/017, FR-025, FR-030/031, FR-034–086; AT-008, AT-010, AT-015/016, AT-027, AT-036–098 |
| Security/privacy | FR-024/026/033/041–044, FR-051–086, BR-041–050/070–112, permissions rules, AT-017–022/026/030/048–098 |
| Concurrency | FR-004/009–012/016/017/020/035/052/056/057/063–086, BR-001/005/006/011/027/036/037/073/078/080/083/086/089–112, AT-002/003/006/007/013–016/029/040/050/055/057/063–098 |
| Schema/migrations | FR-001–005, FR-011/012, FR-018–026, FR-031/034, FR-045–086, BR-022–040/049–112 |
| Testing/phases | All critical acceptance criteria, docs/10-build-plan.md, docs/11-first-codex-prompt.md, README workflow |
# DEC-052 technical note

The administrator presentation layer uses server-rendered route data plus small client components for URL-backed segmented navigation, IntersectionObserver-based contextual back visibility, and a focusable roster dialog. Visual assets are local static files configured in `src/lib/config/admin-visual-assets.ts`; no remote image dependency or database migration is required. KPI queries remain scoped to the already authorized event set.

# DEC-053 technical note

Design Assets uses a `design_assets` metadata table and a dedicated public Supabase Storage bucket.
The upload server action calls `requireSystemAdmin()` before validating an image `File` (JPEG, PNG,
WebP, or SVG; maximum 5 MiB), writes to an opaque storage path, then inserts metadata and an audit
event. A failed metadata insert removes the newly uploaded object. Public pages query only active
metadata through RLS and build public storage URLs; all upload, replacement, retirement, and object
deletion operations remain server-only. Event-specific desktop/mobile assets override category and
local static assets. No participant data, arbitrary file types, client service-role key, or public
write policy is introduced.

# Phase 9 operational design

Local, preview/staging, and production use separate Next.js environment configuration and Supabase
projects. `src/lib/config/env.ts` validates public/server configuration and hosted HTTPS URLs;
server-only credentials remain behind the privileged client boundary. Deployment and migration
procedures are documented in `docs/28` and `docs/31`.
# DEC-051 technical addition

The pilot adds `participant_remembered_devices` in migration `0026`. Server actions resolve the HttpOnly cookie through privileged server-side RPCs. The browser receives only a safe first-name recognition result; participant details and token validation remain server-side. The raw token is generated by `pgcrypto`, stored only in a cookie, and is never placed in URL parameters, local storage, logs, or audit payloads.
