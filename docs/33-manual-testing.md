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
# Participant booking pilot checks

1. Open `/events`, swipe or use the previous/next controls, and confirm the next card is partially visible.
2. Open a class, confirm the focused booking background and `Choose your dates` heading.
3. Select multiple times across grouped dates and confirm the selected count remains visible.
4. Complete a booking and confirm `You’re booked`/booking confirmation copy.
5. On the first-time booking form, optionally choose `Make future bookings faster on this device`, complete the booking, revisit `/register/[slug]` in the same browser, and confirm only `Welcome back, [First name]` appears.
6. Choose `Not you?` and confirm manual entry remains available.
7. Inspect the cookie: it is HttpOnly, SameSite=Lax, scoped to `/register`, and Secure in hosted production.
8. In the admin workspace, confirm event cards show booked, checked-in, and remaining capacity; add a walk-in and confirm the roster updates without a manual reload.
