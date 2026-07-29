# Phase 5 — Attendance, Check-In, Walk-Ins, and Finalization

Status: complete on `phase-5-attendance`; release validation is recorded below.

This slice implements the approved attendance requirements FR-017–FR-021, FR-023–FR-025, FR-031–FR-033, FR-056–FR-057, and BR-022–BR-029. Follow-up task generation, messaging, CRM notes, participant merging, dashboards, and other Phase 6 functionality remain excluded.

## Existing foundation

Migrations `0001`–`0016` already provide `events.attendance_processing_state`, `registrations`, one-to-one `attendance`, immutable `attendance_transitions`, participant normalization fields, acknowledgment evidence, capacity guards, RLS, host-organization scope helpers, and `audit_events`. Registration statuses are `REGISTERED` and `CANCELLED`; attendance results are `NOT_RECORDED`, `ATTENDED`, `NO_SHOW`, and `EXCUSED`; processing states are `NOT_STARTED`, `OPEN`, `FINALIZED`, and `REOPENED`.

## Operational decisions

Attendance is available to an active authorized administrator for a published, non-cancelled event. It is intentionally not restricted to a clock window: the server requires the event to be non-draft/non-cancelled and the administrator to have event access. `OPEN` is required for check-in; finalization atomically converts remaining active `NOT_RECORDED` registrations to `NO_SHOW`. Cancelled registrations are preserved and never become no-shows.

Walk-ins use the existing `registration_groups`, `participants`, `registrations`, and `attendance` tables with `submission_source = WALK_IN`. Matching is deterministic on normalized phone plus normalized first and last name. An existing active registration is reused; otherwise a new registration is created under a transaction. Capacity is enforced by locking the event row. Host Admins cannot exceed capacity; System Admins may use the existing over-capacity override record and reason.

Finalization is explicit, confirmed in the UI, records event state and audit metadata, and is idempotent. Individual corrections are allowed after finalization for both roles with a reason. Only System Admin may reopen a finalized event; reopening preserves current attendance until corrected and requires re-finalization.

## Authorization and security

System Admins have global attendance access. Host Admins have only assigned host-organization event access. Anonymous users, inactive admins, non-admin users, and unassigned Host Admins are denied. Server actions revalidate IDs and call security-definer RPCs; the RPCs re-check `auth.uid()`, event state, registration/event relationships, host scope, capacity, and finalization state. Existing RLS policies remain the database backstop. No service-role credential is used in browser code.

## Routes and UI

`/admin/events/[id]` is extended as the authoritative roster and attendance screen. It displays event/venue-local timing, lifecycle and processing state, capacity, active count, registration source, participant operational fields, and attendance status. It provides Start Check-In, one-action Attend, no-show/correction controls, Add Walk-In, Finalize Attendance, Reopen Attendance (System Admin), and a finalized-state summary. Unauthorized event IDs continue to resolve to the existing access-denied behavior.

## Database changes

Migration `0017_phase_5_attendance_operations.sql` adds narrowly scoped RPCs for opening, marking/correcting attendance, finalizing, reopening, and transactional walk-ins. Migration `0018_phase_5_attendance_transition_enum_fix.sql` is the forward correction for the enum cast in the attendance-transition trigger, the walk-in registration-id handoff, finalization ordering, and correction-reason enforcement after reopening. No new status values or tables were added. RPCs use fixed `search_path`, `SECURITY DEFINER`, authenticated execution only, row locks for capacity/finalization, and append audit rows. Attendance transitions remain append-only through the existing trigger.

## Phase 5C fixture harness and acceptance results

`tests/e2e/phase-5-fixtures.ts` is the single reset-safe fixture system. It creates dynamic Auth users through the local Auth admin API, then creates matching database profiles, two organizations, two assigned venues, provisional/approved synthetic acknowledgments, and isolated events/participants/registrations through explicit helper functions. It never stores passwords, tokens, or storage state. `tests/e2e/phase-5.spec.ts` uses the real browser route, authenticated Supabase RPC clients, and local Postgres assertions; each scenario creates its own UUID-based records.

Synthetic identities cover an active System Admin, an Organization A Host Admin, an Organization B Host Admin, an authenticated user without an admin profile, and a suspended/inactive admin. The event helpers cover ordinary check-in, exact-match reuse, new walk-in, full capacity, three final-spot races, finalization/reopening, Organization B isolation, and cancelled-event rejection.

Results from the additive Phase 5 browser suite: 6 tests passed. Registered check-in persisted after reload; repeated check-in kept one current attendance row and one transition. A pre-finalization `NO_SHOW` request was rejected per BR-027; finalization converted eligible unchecked registrations, preserved cancelled registrations without attendance, and was idempotent. System Admin reopening required a nonblank reason; post-reopen correction required a nonblank reason and preserved immutable `NO_SHOW`→`ATTENDED` history. Host Admin post-finalization correction and reopening were denied.

Walk-in tests passed for exact normalized participant and active-registration reuse, new walk-in participant/registration/acknowledgment/attendance consistency, same-phone/different-name non-match, same-name/different-phone non-match, and same-email/different-phone/name non-match. Full-event rejection rolled back the attempted participant, group, registration, acknowledgment, and attendance. Three synchronized RPC competitions each produced one success and one capacity result; final active count was exactly capacity, with no orphan groups or failed attendance.

Direct RPC tests denied unassigned Host Admin, non-admin, inactive admin, and anonymous mutations; Host Admin could operate only Organization A and could not read or mutate Organization B. Cancelled-event open, mark, walk-in, finalize, correction, and reopen attempts were all denied without attendance history. Audit assertions covered actor, event/attendance context, server timestamps, check-in, walk-in creation/reuse, finalization, reopening, and correction. The browser route exposes no Host Admin reopen or finalized-state correction controls.

The first local reset applied migrations through `0018`, passed schema assertions and lint, and ran the complete Phase 5 suite. The second reset regenerated the Auth identities and fixtures and reran the Phase 5 suite plus all three final-spot competitions and authorization/finalization checks; it passed. The existing regression suite remains additive: 16 Vitest unit/component tests and 15 prior-phase Playwright tests.

The roster uses the Phase 5 RPCs for all attendance mutations. During acceptance review, the roster correction UI was tightened so that it exposes real attendance-result forms, requires a reason for System Admin post-finalization corrections, and does not expose Host Admin correction controls after finalization. `EXCUSED` is accepted by the server action for the documented cancelled-event/check-in correction model.

Validation completed in this working tree:

- Phase 5 schema assertions: passed after applying migration `0017` to the local database.
- Supabase schema lint: passed with no schema errors.
- Unit/component tests: 16 passed.
- TypeScript, ESLint, formatting, and production build: passed.
- Existing Playwright regression: 15 passed across smoke, authentication, Phase 3, and Phase 4.

The Phase 5C harness and acceptance suite are complete. The Participation acknowledgment remains PROVISIONAL, so production deployment remains blocked by the documented legal gate; this does not block synthetic local acceptance testing.

## Known limitations and explicit exclusions

This phase does not generate follow-up tasks even though the frozen product documents describe that later trigger; it only preserves the attendance data needed by that phase. It does not send communications, edit CRM notes or profiles, merge participants, provide analytics, payments, memberships, waitlists, QR check-in, or native mobile functionality. Production remains blocked until the provisional Participation acknowledgment receives legal approval.
