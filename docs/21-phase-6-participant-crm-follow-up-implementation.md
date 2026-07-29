# Phase 6 — Participant CRM, Follow-Up Tasks, and Accountability

## Scope and requirement IDs

This slice implements FR-022–FR-027, FR-034–FR-038, FR-054–FR-055 and the related BR/AT requirements for participant visibility, attendance-derived first-time status, idempotent first-attendance and finalized no-show tasks, manual copy/completion, reconciliation, and authorization. The dedicated Phase 6 brief intentionally delivered the follow-up slice alongside CRM; DEC-047 now records that the older Phase 7 follow-up definition was absorbed into Phase 6 and superseded by the post-MVP publishing/link-distribution phase.

Explicit exclusions remain participant accounts, participant merging, broad profile editing, automated email/SMS/WhatsApp, external CRM integrations, marketing automation, analytics dashboards, payments, deployment, and the not-yet-implemented Phase 7 publishing/link-distribution functionality.

## Participant CRM and visibility

System Admins may search active participants by normalized first/last name, normalized E.164 phone, or normalized email using a minimum two-character query and a bounded limit of 50. The profile shows approved contact details, current affiliation, upcoming and prior registrations, attendance results, first/last attendance, attendance/no-show/cancellation counts, and follow-up history. Contact fields are read-only in this phase.

Host Admins do not receive the global directory or global CRM profile. Existing event roster access remains scoped by `Event.host_organization_id`; any host-specific participant view must contain only registrations and attendance tied to assigned organizations. Participant affiliation never grants access to another organization’s history. Anonymous, inactive, unassigned, and non-admin users are denied.

## First-time attendance and reconciliation

The authoritative qualifying record is an `ATTENDED` Attendance with a non-null `finalized_at`, attached to an active registration for a non-cancelled Event. Registration, check-in without finalization, no-show, participant cancellation, event cancellation, and unfinalized walk-in attendance do not qualify.

First attendance is selected by Event `starts_at`, with the Event ID only as a deterministic tie-breaker for the participant’s historical first event. For current-event indicators, equal timestamps are not prior and the current event is excluded until finalization. The application must calculate indicators from attendance joins rather than persist booleans.

An after-insert/update Attendance trigger calls one security-definer reconciliation function. It creates or reopens exactly one `first-attendance:{participant_id}` task and exactly one `no-show:{registration_id}` task per qualifying result. When a correction removes qualification, an open task is dismissed with an explanation; completed history is retained and is never silently reset. A later qualifying correction may reopen a dismissed task or create the missing qualifying task, while completed outreach remains historical. A transaction advisory lock serializes participant reconciliation, and the unique trigger keys prevent duplicates during retries. Re-finalization is therefore idempotent.

## Task model and lifecycle

Tasks carry participant, event, host organization, reason, trigger key, title, description, versioned template key, editable suggested message, due timestamp, assignee, copy evidence, completion outcome, and audit timestamps. Statuses are `PENDING`, `COMPLETED`, and `DISMISSED`; overdue is derived from `PENDING` plus `due_at < now()` and is never stored.

First-attendance due time is the stored Event end instant plus 24 hours. Finalized no-show tasks use the same event-end-plus-24-hour operational due rule. Timestamps are stored in UTC and displayed in the Event timezone. Reconciliation may leave tasks unassigned; System Admin can assign or reassign an active System Admin or an active Host Admin assigned to the task’s host organization. Host Admin task visibility remains prohibited by the frozen permissions model.

Completion requires one of `CONTACTED`, `NO_RESPONSE`, `FOLLOW_UP_NOT_NEEDED`, or `WRONG_CONTACT_INFORMATION`. Dismissal requires a short reason. Both operations record actor, time, prior/new state, and outcome/reason in append-only audit events. Copying records task ID, template key, actor, and time only; it never completes or claims delivery.

## Templates and copy workflow

Phase 6 seeds two stable template keys (`first-attendance-v1`, `no-show-v1`) in the reconciliation function. Messages are rendered from participant/event context, stored as an editable operational snapshot, and may be edited by System Admin. The UI provides Copy, records copy evidence, and keeps the task open. No external channel is opened and no message is sent automatically.

## Database, RLS, grants, and audit

Migration `0019_phase_6_crm_follow_up.sql` is forward-only and leaves `0001`–`0018` unchanged. It adds task ownership/CRM metadata, indexes, completion constraints, a task timestamp trigger, attendance-driven reconciliation, bounded System Admin participant search, and lifecycle RPCs. Existing RLS remains fail-closed: the System Admin policy is the only follow-up-task policy; Host Admin policies do not expose global follow-up tasks. RPCs are `SECURITY DEFINER`, use a fixed `search_path`, reject non-System Admin actors, and are granted only to `authenticated`.

Attendance transitions and task actions append to the existing `audit_events` table. No credentials, clipboard content, raw authentication data, confirmation-token hashes, or unrelated history are exposed.

## Routes and UI

System Admin routes are `/admin/participants`, `/admin/participants/[id]`, and `/admin/follow-ups`. The queue defaults to pending tasks ordered overdue first, then due time, and supports overdue/today/upcoming/completed filters, reason, assignee, and participant search. Cards display participant, organization, source event, due time, assignee, status, editable message, Copy, Complete, and Dismiss. Participant profiles separate upcoming registrations, event history, attendance results, and follow-up history.

## Testing and reset behavior

Database assertions cover trigger idempotency, first-attendance/no-show correction, due timestamps, task uniqueness, lifecycle constraints, System Admin-only RPCs, and assignment scope. Component and route tests cover status rendering, queue filters, copy feedback, completion, dismissal, and role denial. Existing Phase 1–5 tests remain required. Validation uses local Supabase and synthetic fixtures; each clean reset applies `0001`–`0019` and reruns prior regressions before Phase 6 tests.

### Phase 6B Auth fixture recovery

The initial browser baseline contained 21 tests. Nineteen failed before test-specific assertions because the Playwright process had no `NEXT_PUBLIC_SUPABASE_URL` (or corresponding local keys); the two public smoke tests passed. Next was already configured with `APP_ENV=test`, but that setting only applied to the web server and did not provision the test workers. The failure was therefore shared process-environment/bootstrap drift, not an Auth profile, RLS, middleware, cookie, or token-validation defect.

`tests/e2e/test-environment.ts` now obtains the local-only values from `supabase status -o env`, requires `http://127.0.0.1:54321`, sets `APP_ENV=test`, and supplies the public and service-role values to the Playwright process and web server. `tests/e2e/global-setup.ts` repeats the non-secret assertions and fails early if the server is not in the test environment or the local API is unavailable. No credentials, tokens, or storage-state files are committed. Existing Phase 3–5 fixture helpers remain the shared identity/data foundation; each fixture creates fresh random Auth identities, resolves the generated Auth IDs, links application profiles, creates assignments, and signs in with runtime-only passwords.

The authoritative storage-state policy is disposable: the current suite establishes sessions directly in each test context after the current reset, and no long-lived storage state is used. This makes a clean reset safe because identities, profiles, sessions, and task fixtures are recreated together. The fixture smoke coverage includes anonymous redirect, System Admin authentication, Host Admin authentication, non-admin/inactive denial, organization assignment resolution, and reload persistence through the existing authentication and Phase 6 browser specs.

### Phase 6B browser acceptance results

The frozen Phase 6 role boundary is System Admin-only for participant search, participant profiles, global follow-up history, and all follow-up task mutations. Host Admins remain limited to assigned event operations and cannot access global CRM routes or mutate tasks. The authoritative first-attendance rule is one finalized `ATTENDED` record on an active registration for a non-cancelled event; the task is due at the stored event end instant plus 24 hours. Reconciliation is keyed by `first-attendance:{participant_id}` and `no-show:{registration_id}` and is idempotent across repeated attendance updates.

The focused browser coverage verifies participant search/profile, route denial, first-attendance and no-show task creation, editable operational messages, copy evidence without delivery or completion, completion persistence, dismissal reason enforcement, and direct Host Admin RPC rejection. Message edits reject blank content and content over 2,000 characters at the database RPC boundary. The unchanged prior-phase suite remains intact.

First clean-reset release pass: database migrations through `0019`, schema/runtime assertions, and schema lint passed; static checks passed; prior Phase 1–5 browser coverage passed `21/21`; Phase 6 browser coverage passed `4/4`; complete browser count was `25/25`.

Second clean-reset release pass: Supabase was stopped with local data removed and restarted, migrations through `0019` were reapplied, identities and application profiles were recreated by the fixtures, and the complete browser suite passed `25/25` again. This confirms no stale Auth IDs, tokens, storage state, or test-order dependency.

The final static validation was TypeScript pass, ESLint pass, Prettier check pass, 16/16 unit/component tests pass, and production build pass. Direct database validation passed Phase 1 schema/runtime, Phase 2 auth, Phase 6 schema/runtime, and Supabase schema lint. The Participation acknowledgment remains `PROVISIONAL`; legal approval remains a production blocker.

## Production legal gate

The Participation acknowledgment remains `PROVISIONAL`; synthetic content is permitted locally only. No production deployment, legal-language change, or release-control bypass is included. Production remains blocked until Legal approves an acknowledgment version and the database contains an approved version.

## Known limitations

The initial template set is code-seeded rather than administrator-managed. Participant contact editing, participant merging, notes UI, advanced analytics, and Host Admin global follow-up access are intentionally deferred. The phase completion tag must not be created until the full mandatory validation matrix, including a second clean reset and all prior-phase regressions, passes.
