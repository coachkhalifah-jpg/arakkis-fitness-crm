# Architecture baseline

## Application shape

Next.js App Router server components render public and admin pages. Client components provide forms, loading states, focus behavior, and other presentation controls. Server actions validate FormData and resolve the current authenticated administrator independently.

Major routes include `/events`, `/register/[slug]`, `/registration`, `/registration/confirmation`, `/manage-bookings`, `/admin`, `/admin/events`, `/admin/organizations`, `/admin/venues`, `/admin/invitations`, `/admin/participants`, `/admin/follow-ups`, `/admin/design-assets`, and protected detail/QR routes.

## Service and action structure

- `src/lib/authorization/server.ts` centralizes active-admin, System Admin, Host Admin, and organization-scope checks.
- `src/lib/services/phase-3-actions.ts` owns Organization, Venue, and Event actions.
- `src/lib/services/phase-5-actions.ts` owns attendance and roster operations.
- `src/lib/services/phase-6-actions.ts` owns CRM/follow-up operations.
- `src/lib/services/phase-7-actions.ts` owns publishing, links, QR, and invitations.
- `src/lib/services/design-assets-actions.ts` owns System Admin design-asset uploads/replacements.
- `src/lib/services/event-creation-lifecycle.ts` and `design-asset-replacement.ts` isolate retry/rollback boundaries.

## Supabase, migrations, and Storage

Ordered migrations define schema, constraints, RPCs, grants, RLS, public projections, audit/history, publishing, legal gates, and the validated J5 atomic Event creation RPC in `0040_atomic_event_creation.sql`. The SSR Supabase client carries user sessions; the privileged client is server-only and reserved for trusted workflows and test setup. Event images use the `design-assets` bucket and `design_assets` metadata. Replacement stages a new object, validates intent and scope, retires the previous asset, activates the new asset, attempts old-object cleanup, and records cleanup debt without invalidating a committed replacement.

## Authorization and RLS

Navigation is convenience only. Routes and server actions enforce authorization, and RLS/data access provides defense in depth. `SYSTEM_ADMIN` is global. `HOST_ADMIN` is constrained to assigned Organizations and their Events; the current validated Venue rule permits assigned-Organization read/create/update while Venue archive remains System Admin-only. Organizations management and global design assets are System Admin-only. Direct identifiers and manipulated requests must receive the same scope checks as normal UI paths.

## Audit model

Durable mutations write `audit_events` with actor, action, entity, and old/new values. Attendance transitions, cancellation history, and other immutable histories are protected by database constraints/triggers. Audit failures are treated as operation failures where the workflow requires an auditable mutation.

## Event creation idempotency

The J5 RPC accepts a request identity, actor, event/occurrence payload, asset payload, action, and audit payload. It validates the actor and relationships, rejects replay with changed logical inputs, persists the event bundle atomically, records the audit, and handles staged image references only within the request scope. The application performs MIME/5 MiB validation and Storage cleanup around the RPC boundary.

## Fixtures and local environment

Docker/Supabase provide local Postgres, Auth, Storage, and Mailpit. `.env.local`, `.demo-credentials.local`, and `.demo-routes.local.md` are ignored local artifacts. `pnpm demo:reset` creates synthetic identities and journey states; `pnpm fixtures:reset`/`fixtures:verify` provide fixture workflows. Playwright preflight uses the local reset path. `scripts/audit-event-image-storage.mjs` audits and safely removes only confirmed local unreferenced Event-image objects.
