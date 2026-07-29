# Manual testing guide

## Anonymous participant

Check `/`, `/events`, an available event, registration validation and confirmation, partial success,
closed/full/unpublished states, legal blocking, mobile layout, keyboard focus, labels, and safe
invalid slugs. Expected: no account is required, no private history is exposed, and legal blocking
prevents submission in production-equivalent mode.

## System Administrator

Sign in at `/admin/sign-in`; verify dashboard, organizations, venues, events, publication, canonical
link/QR, invitations, participants, attendance, CRM/follow-ups, and logout. Expected: global access,
audited changes, scoped confirmation links, and no automatic message sending.

## Host Administrator

Sign in with a synthetic invited user; verify assigned organizations/events, roster, walk-ins,
check-in/finalization/corrections allowed by policy, and cancellation-request operations. Attempt
unrelated event URLs, global participants, follow-ups, and user management. Expected: server-side
denial and no cross-organization data leakage, regardless of navigation visibility.

Record browser, viewport, role, route, expected/actual result, console/server observations, and
whether data is synthetic. Never record credentials or tokens.
