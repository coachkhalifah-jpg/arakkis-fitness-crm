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
