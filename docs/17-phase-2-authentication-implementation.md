# Phase 2 — Authentication, Invitations, and Authorization Foundation

## Scope and requirement traceability

This implementation covers FR-042–FR-044 and FR-059, BR-089–BR-091, DEC-023 and DEC-040, and the authentication/authorization portions of AT-059 and AT-088–AT-089. It intentionally does not implement organizations, venues, events, registration, attendance, CRM, follow-up, or notification UI.

## Architecture

- Supabase Auth is the identity/session authority. The browser uses only the publishable/anonymous key through `@supabase/ssr`.
- `src/lib/db/server.ts` creates the request-scoped SSR client. `proxy.ts` refreshes cookies with `getUser()` and applies only an initial route gate.
- `src/lib/authorization/server.ts` resolves the current Auth user, active `admin_profiles` row, role, and active organization assignments on every server request. Database role/status/assignments are authoritative; browser state and claims are not.
- `src/lib/auth/actions.ts` contains server actions for sign-in, sign-out, invitation creation/revocation, and acceptance. Sensitive invitation work uses the server-only service-role client and a compensating Auth-user deletion if database activation fails.

## Behavior mapping

| Behavior | Application layer | Database layer | Supabase Auth | Authorization | Tests |
|---|---|---|---|---|---|
| Sign in/sign out | Server actions and accessible form | N/A | `signInWithPassword`, `signOut` | Protected page resolves fresh user | unit/component/E2E |
| Session refresh | `proxy.ts` SSR cookie refresh | N/A | `getUser()` refreshes session | Middleware is only a first check | E2E/manual |
| Invitation creation/revocation | Server-only actions, 256-bit token generation and SHA-256 hash | Existing invitation/audit tables; System Admin RLS | N/A until acceptance | `requireSystemAdmin` | unit/database |
| Invitation acceptance | Server action validates email/token and calls RPC; no raw token logging | Migration `0013` locks invitation, copies fixed assignments, activates profile, consumes token, and audits atomically | Admin API creates or updates the invited identity | Invitee cannot alter role or assignments | unit/database/integration |
| Admin context | Typed `getAdminContext`/`require*` helpers | Existing `is_active_system_admin` and `has_event_access` remain authoritative | `auth.uid()` is linked to profile ID | Server/data-access boundary plus RLS | unit/database |
| Protected `/admin` | Page calls `requireActiveAdmin` | Existing RLS denies unauthorized reads | Session cookie | Unauthenticated redirect; non-admin/inactive access denied | component/E2E |

## Session and redirect flow

1. A request reaches `proxy.ts`; the SSR client calls `getUser()` and refreshes Supabase cookies.
2. `/admin` requests without a user are redirected to `/admin/sign-in?next=/admin`.
3. The sign-in action accepts only a local application path (`/admin...`) and rejects absolute, protocol-relative, backslash, or external targets.
4. The protected page calls `requireActiveAdmin`, which re-resolves the Auth user and database profile. It redirects non-admin and inactive users to `/admin/access-denied`.
5. Sign-out uses the server client and redirects to the public page.

## Invitation flow

System Admin actions generate a secure random token, persist only its SHA-256 `bytea` hash with a 72-hour expiry, and return the raw token only as a one-time invite URL to the caller. Creation and revocation are audited. Acceptance validates the token, expiry, pending state, normalized email, and fixed invitation assignments. Supabase Auth identity provisioning is outside the PostgreSQL transaction; on RPC failure, a newly created Auth user is deleted as compensating cleanup. The RPC transaction itself locks and validates all invitation state, inserts the profile, copies assignments, consumes the invitation, and writes the audit event. Raw tokens never enter logs, URLs are never rendered after the acceptance form submission, and all invalid invitation responses are generic.

## Environment and local testing

Required variables are listed in `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` is read only by `src/lib/db/privileged.ts`, which is marked `server-only`; it is not imported by client components. Use local Supabase only, with disposable synthetic identities. Provision the initial System Admin through the local Supabase Auth admin API and insert the matching `admin_profiles` row using a local-only script or SQL fixture. Create test Host Admin invitations through the System Admin action, and use Mailpit or the returned local invite URL.

Run `supabase start`, `supabase db reset`, `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build`, and `pnpm test:e2e` in a configured local environment. Database assertions should verify the migration, RPC grants, invitation hash-only storage, token replay rejection, email matching, and active-assignment enforcement.

## Audit and security decisions

Invitation creation, revocation, and acceptance write `audit_events`. The acceptance RPC uses a fixed `search_path`, is granted only to `service_role`, and validates the authenticated identity email and invitation role/assignments. Role and organization values are never accepted from the invitee. Unexpected errors return generic UI messages; detailed database/auth errors stay server-side and are not logged with token material. A disabled or assignment-less admin is denied on the next server authorization resolution.

## Known limitations and deferred functionality

Supabase Auth user creation and the PostgreSQL activation transaction cannot share one transaction boundary; compensating deletion is used for newly created users, and the boundary is documented above. The Phase 2 landing page is deliberately a proof-of-access placeholder. Invitation delivery, organization-management UI, event operations, public registration, attendance, CRM, follow-up, notifications, dashboards, and production deployment remain deferred. Production remains blocked while the Participation acknowledgment is PROVISIONAL.
