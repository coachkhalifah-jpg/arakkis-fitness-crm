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

## Phase 3B completion plan

The operational completion slice adds protected detail routes for organizations, venues, and events; reusable client action forms with pending, success, error, and confirmation states; System Admin edit workflows; practical list filtering; and Playwright flows using local synthetic identities. Host Admin pages continue to use RLS-backed reads and omit mutation controls, while direct mutation actions independently require System Admin authorization. No new migration is planned: migration `0014` remains the lifecycle and relationship guard boundary.

## Phase 3B validation result

Completed routes are `/admin/organizations`, `/admin/organizations/[id]`, `/admin/venues`, `/admin/venues/[id]`, `/admin/events`, and `/admin/events/[id]`. The local Chromium flow covers System Admin sign-in, organization creation/editing, venue creation/edit submission, event draft creation/editing, publication, independent copied-draft verification, and permanent cancellation verification. Existing Phase 2 browser coverage continues to pass, including Host Admin authentication and unauthorized access denial.

Validation completed on 2026-07-28/29: 8 Playwright tests passed, 11 unit tests passed, strict TypeScript, ESLint, formatting, and production build passed. Migration `0014` was applied and exercised against the running local Supabase database with synthetic records; the CLI reset command remains environment-blocked by the pre-existing Docker project-name mismatch, so no new migration was added during Phase 3B. No secrets or service-role credentials are present in browser-bundled application modules.

The participation acknowledgment remains provisional, so production deployment remains blocked by the existing legal gate. Full participant registration, attendance, CRM, follow-up, notification, and analytics functionality remains deferred.

## Phase 3C final acceptance validation

Validation was completed locally on 2026-07-29 from commit `e8fa7810cb4f693d91715ee830a9d42ef9afef84` on branch `phase-3-organizations-events`. No hosted Supabase project, production credentials, or real identities were used.

### Local Supabase reset repair

The reported reset failure was a Supabase CLI 2.110.0 local wrapper/profile bootstrap defect: `supabase db reset` stopped before reaching Postgres with `failed to read profile: Config File "config" Not Found`. Docker inspection showed no project mismatch. All running containers, the database/storage/edge-runtime volumes, and the network were labeled `fitness-event-crm-codex-starter` and pointed at this repository; no unrelated Docker resources were removed.

The safe workaround is the existing `scripts/validate-database.sh` procedure: stop this project with `supabase stop --no-backup`, start it again, run the database checks, repeat the stop/start reset, and rerun the checks. Both clean reset cycles applied migrations 0001–0014, passed Phase 1 schema/runtime checks, passed Phase 2 auth checks, and passed Supabase schema lint. The CLI `db reset` wrapper remains unreliable, but the underlying local reset is repeatable through this project-scoped workaround.

### Synthetic browser fixtures and results

Playwright creates dynamic synthetic identities and records per test. The fixtures include Organization A and B, a venue and event in each organization, a System Admin, an active Host Admin assigned only to Organization A, active registrations for capacity tests, and no real credentials or reusable secrets.

- Host Admin sees only assigned organization, venue, and event data; management controls are absent.
- Direct unassigned organization, venue, and event URLs reveal no protected entity data and resolve to a denial/not-found state. Direct authenticated mutation attempts do not change Organization B.
- A draft event with three `REGISTERED`/`ACTIVE` registrations accepts capacity 4 and capacity 3, rejects capacity 2 with a safe error, and remains persisted at capacity 3. The database trigger and direct database update both enforce the floor. Cancelled/non-active registrations are excluded by the authoritative active-registration predicate.
- A venue timezone update from `America/New_York` to `America/Chicago` persists through the browser and creates a `VENUE_UPDATED` audit record. The event's stored UTC start and end remain unchanged before and after the update. Invalid timezone input is rejected server-side and does not change the venue.

The venue detail form now uses the shared action-state form so successful and rejected timezone updates are visible in the browser. Venue and event detail lookups now explicitly deny Host Admin access when RLS hides an inaccessible entity. No migration was added and migrations 0001–0014 were not modified.

### Final validation

The complete serial Chromium suite passed 11 tests. Unit tests passed 11 tests. Strict TypeScript, ESLint, Prettier, production build, database schema assertions, Phase 1 and Phase 2 runtime regressions, and schema lint passed. No browser-bundle service-role credential or machine-specific path was introduced. The requirements freeze remains in force; public registration, attendance, participant CRM, follow-up, notifications, and all Phase 4 functionality remain deferred.
