# Phase 1 — Database Schema & Supabase Implementation

Phase 1 implements the database foundation for FR-001–FR-086, BR-001–BR-112, DEC-001–DEC-046, and the database/RLS portions of AT-001–AT-098. No application feature, authentication UI, or user-facing workflow was added.

## Migrations

Migrations are forward-only and ordered by dependency:

1. `0001_extensions_and_enums.sql` — `pgcrypto`, enum vocabulary, timestamp helper.
2. `0002_identity_and_event_foundation.sql` — organizations, venues, admin profiles/invitations/assignments, events, participants, invitation organizations.
3. `0003_registration_and_attendance.sql` — event eligibility, acknowledgment versions, registration groups, duplicate cases, registrations, attendance, attendance transitions, follow-up tasks, confirmation tokens.
4. `0004_cancellation_and_notification.sql` — cancellation templates/requests/records, notification tasks/deliveries/transitions, over-capacity overrides, acknowledgment acceptances.
5. `0005_audit_and_identity_history.sql` — merges, merge conflicts, notes, audit events, completed-event invalidation evidence.
6. `0006_constraints_triggers_and_security_helpers.sql` — invariant triggers, immutable evidence guards, timestamp triggers, attendance/notification transition recorders, authorization helpers.
7. `0007_rls_and_public_projections.sql` — RLS on every application table, scoped policies, and the narrow public event schedule view.
8. `0008_public_registration_rpc.sql` — the only anonymous write surface: a validated, capacity-safe, multi-date registration transaction returning submission-scoped results and a raw one-time-issued confirmation token.

## Tables and enums

The schema contains 30 approved tables: organizations, venues, admin_profiles, admin_invitations, admin_organization_assignments, admin_invitation_organizations, events, participants, event_eligible_organizations, acknowledgment_versions, acknowledgment_acceptances, registration_groups, registrations, attendance, attendance_transitions, follow_up_tasks, confirmation_tokens, event_cancellation_requests, event_cancellations, cancellation_template_versions, participant_notification_tasks, participant_notification_deliveries, notification_delivery_transitions, over_capacity_overrides, possible_duplicate_cases, participant_merges, participant_merge_conflicts, participant_notes, completed_event_invalidations, and audit_events.

PostgreSQL enums cover organization/admin/event/registration/attendance/follow-up/notification/cancellation/template/acknowledgment/invitation/duplicate/merge/WhatsApp/transition/override state vocabularies. Primary and foreign keys use UUIDs; historical parents are `ON DELETE RESTRICT`; active registration, pending cancellation request, confirmation token, notification recipient, template/version, and override uniqueness are indexed.

## RLS summary

- Every application table has RLS enabled and denies access by default.
- System Admin access is global only when the linked profile is active and has `SYSTEM_ADMIN` role.
- Host Admin scope derives from `events.host_organization_id` and active organization assignments. Participant affiliation is never used for authorization.
- Host policies scope rosters, attendance, cancellation requests/history, notification operations, and exports through the Event.
- Follow-up tasks, global participant data, merge records, notes, acknowledgment evidence, and general audit data are not exposed to Host Admins.
- Anonymous users have no direct table access. They receive only the narrow `public_event_schedule` projection and execute `register_selected_events`; confirmation-token access remains a future narrow read endpoint.

## Generated types

`src/types/generated/database.ts` is generated from the ordered migrations by `scripts/generate-database-types.mjs` and is not manually edited. Regenerate with:

```bash
node scripts/generate-database-types.mjs
```

The current generated artifact contains 30 tables and 30 enums.

## Validation performed

- Confirmed the starting worktree was clean and created the required branch.
- Regenerated TypeScript database types from migrations.
- Reviewed migration ordering, dependency edges, foreign-key delete behavior, unique indexes, immutable evidence guards, and RLS scope predicates.
- Ran available repository checks after dependency/runtime issues are resolved.

The workspace does not include the Supabase CLI, PostgreSQL client/server, Docker, or a secret-scanning executable. Therefore an empty-database apply/rollback, live RLS integration test, and dedicated secret scanner could not be run locally. The SQL remains intended for Supabase CLI application and should be applied in a disposable Supabase project before deployment.

## Deferred work

Application data-access wrappers, authentication and invitation UI, event management, public registration UI, confirmation endpoint, attendance UI, CRM, follow-up UI, exports, calendar serializers, seed data, and integration/E2E tests remain deferred to later phases.

## Known limitations

- The database RPC accepts normalized contact values supplied by the trusted validation boundary; libphonenumber-compatible parsing remains an application validation responsibility.
- Confirmation-token validation/read and rate-limit projection are schema-ready but their narrow endpoint is deferred with the application layer.
- Cancellation approval/finalization, attendance finalization/reopening, merge, invitation acceptance, and notification state-machine commands require later application transactions around the persisted constraints and audit tables.
- The Participation acknowledgment legal gate remains provisional until an approved version exists.
