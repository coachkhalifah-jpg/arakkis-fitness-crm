# Operational readiness

## Security and observability

The app sends `X-Content-Type-Options`, `X-Frame-Options`, strict referrer policy, and a restrictive
permissions policy. HSTS is a hosted HTTPS configuration decision and must be enabled only after the
domain/HTTPS path is verified. Do not add an untested CSP. Sensitive/admin responses must not be
cached publicly. Review browser bundles to ensure no service key is present.

Log event identifiers, severity, operation, actor category, and safe error codes. Review deployment,
application, Supabase database, and Auth logs for failed registrations, denied admin actions,
invitation failures, migration failures, and legal-gate blocks. Never log passwords, session or
invitation tokens, service keys, complete environments, or unnecessary participant data.

## Health and smoke checks

Use `/`, `/events`, a valid and invalid `/register/<slug>`, `/admin/sign-in`, authenticated session
and logout checks, static asset checks, legal-gate checks, and server-side DB/RLS checks. Do not add
a public endpoint that exposes database diagnostics.

## Backup/recovery and rollback

Confirm Supabase backup/PITR capabilities for the selected plan; this repository makes no plan claim.
Test restoration into a separate user-owned environment, never development or production in place.
Validate migrations, RLS, Auth, legal gate, and administrator access after restore. Roll back Vercel
to the previous known-good deployment after checking schema compatibility. Database rollback prefers
forward-fix; restore only with an incident decision. Configuration rollback restores prior values
securely and redeploys.

## Incidents and secret rotation

Contain first: pause affected operations, preserve sanitized logs, notify the owner, revoke/rotate
credentials, and isolate preview/production. For authorization or participant-data concerns, stop
access and review RLS/audit history before reopening. For a legal-gate concern, block registration
and verify the database function/settings. Rotate Supabase public keys when applicable, service key,
database password, Supabase/Vercel/Git tokens, and Auth credentials in their owning systems; redeploy
all affected environments and run smoke tests.

## Owner-controlled administrator recovery

Only the business owner or an explicitly designated owner-controlled operator may perform
administrator recovery in a hosted environment. Engineering must not use a service key, Auth Admin
API, or production SQL for this procedure. First pause administrator operations, preserve sanitized
logs, confirm the incident and operator identity out of band, and take a backup/PITR checkpoint.

If a valid active System Admin still exists, use the reviewed 0067 lifecycle RPCs from the owner-
authenticated Supabase SQL console or an owner-controlled maintenance tool:

1. Verify the target Auth user, profile ID, requested Host Admin status, and Organization IDs.
2. Call `deactivate_admin_profile`, `reactivate_admin_profile`,
   `add_admin_organization_assignment`, or `revoke_admin_organization_assignment` with the active
   System Admin profile ID and a non-empty incident reason. Do not edit lifecycle tables directly.
3. Confirm the resulting profile/assignment state, the matching immutable `audit_events` rows, and
   a fresh authenticated request denial/allow result before reopening access.

If no active System Admin remains, the owner must first restore the owner-verified Auth identity and
its `SYSTEM_ADMIN` profile through the owner-controlled Supabase recovery process. Use a reviewed
transaction, set `app.admin_lifecycle_mutation` only for that recovery transaction, record the
owner/profile identity and incident reason in `audit_events`, and never create a default password or
share a service credential. Then use the 0067 RPCs for all Host Admin recovery and assignment work.

After recovery, rotate any suspected credentials, review Auth/database/audit logs for unauthorized
requests, verify that inactive or unassigned Hosts are denied immediately, and retain the checkpoint
and recovery record with the incident. This procedure does not restore archived Organizations,
Venues, Events, registrations, or immutable history.
