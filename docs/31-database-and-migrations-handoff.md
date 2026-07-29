# Database and migrations handoff

`supabase/migrations/0001`–`0022` define extensions/enums, organizations/venues/events, participants,
registrations/attendance, cancellation/notification, audit/history, RLS and public projections,
registration RPCs, authentication profiles/assignments, CRM/follow-up, publishing/slugs, and the
legal gate. Generated types live in `src/types/generated/database.ts`.

Critical behavior is enforced with constraints, triggers, RPCs, grants, and RLS: capacity and
duplicate-registration concurrency, organization scope, attendance transitions, idempotent
follow-up, invitation token lifecycle, public slug resolution, and fail-closed legal registration.

Run `bash scripts/validate-database.sh` for clean local replay, SQL assertions, runtime tests,
schema lint, and concurrency. To add schema, create the next ordered migration, update generated
types and assertions, test from a clean reset, and never edit an applied migration. Hosted flow is
staging first, status/schema review, backup confirmation, then production apply. Manual dashboard
edits are prohibited unless reconciled into a migration. Production is never reset.

Local fixtures are synthetic and runtime-generated. There is no production seed. The initial
production System Admin is provisioned by the owner through a secure Auth/admin workflow with no
default password documented here.
