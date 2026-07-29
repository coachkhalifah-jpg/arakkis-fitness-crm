# Phase 3 — Organizations, Venues & Events Implementation

## Scope and requirements

This slice implements FR-001–FR-005, FR-031–FR-033, BR-001–BR-006, BR-043–BR-050, and the related AT-063–AT-073 authorization and event-management coverage. It is limited to authenticated administration of organizations, venues, and events. Public registration, attendance, participant CRM, follow-up, and notification delivery remain deferred.

## Architecture

- `/admin/organizations`, `/admin/venues`, and `/admin/events` are server-rendered administrative routes.
- Forms call server actions in `src/lib/services/phase-3-actions.ts`. Actions resolve the current active admin independently and validate all FormData with Zod.
- Reads and writes use the authenticated Supabase server client, so database RLS remains active. No service-role client is used by this feature.
- `src/lib/services/phase-3.ts` contains typed validation, timezone conversion, scope checks, and audit writes. `src/lib/authorization/server.ts` remains the centralized role/scope boundary.
- System Admins have global organization, venue, and event management. Host Admins receive assigned-organization reads only and cannot mutate Phase 3 records.

## Workflows and rules

- Organizations and venues are archived with `ARCHIVED` plus `archived_at`; no hard-delete UI exists. Active organization names are unique case-insensitively.
- Venues require an IANA timezone validated server-side. Editing a venue timezone does not rewrite existing event instants.
- Events are created as `DRAFT`, may publish to `OPEN` only after validation, and may not restore from `CANCELLED`. Core event ownership is immutable after publication.
- Copy Event creates a new `DRAFT` with a new ID and reusable descriptive/scheduling fields only; registrations, attendance, cancellation, overrides, notifications, and audit history are not copied.
- Cancellation is a confirmed System Admin operation and retains the event. Phase 3 records the cancellation audit/state only; participant outcome and notification workflows remain deferred.
- Capacity is positive and cannot be reduced below active registrations. No over-capacity override UI is implemented in this phase.
- Local event date/time is interpreted in the authoritative venue timezone and persisted as UTC plus the event timezone. Nonexistent DST times are rejected; ambiguous times require an explicit occurrence choice.

## Database and security

Migration `0014_phase_3_event_guards.sql` adds database-enforced event lifecycle and relationship guards without changing migrations `0001–0013`. Existing RLS policies provide System Admin global access and Host Admin assigned-event/venue/organization reads. The application additionally scopes every query and mutation. Every create/update/archive/publish/copy/cancel operation appends an `audit_events` record.

## Tests and local validation

Unit tests cover timezone conversion, validation, lifecycle transitions, capacity checks, and action authorization boundaries. Database tests cover the new trigger and existing Phase 1/2 regressions. Browser coverage exercises the System Admin organization/venue/event flow and Host Admin read scope when local Supabase credentials are available.

## Deferred functionality

Public event browsing/registration, registration outcomes, attendance/check-in, participant history and CRM, follow-up tasks, cancellation requests, notification delivery, WhatsApp, dashboards, payments, and all other post-Phase-3 functionality are explicitly out of scope.
