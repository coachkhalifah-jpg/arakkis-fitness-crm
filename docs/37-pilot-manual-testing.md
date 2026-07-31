# Pilot manual testing guide

This guide is for the local synthetic pilot only. It never enables production registration and never
uses real participant data.

## Start and reset

1. Start Docker.
2. From the repository root run `pnpm demo:reset`.
3. Start the app with `pnpm dev` using local Supabase values in `.env.local`, or use the existing
   local stack workflow in `docs/27-local-development.md`.
4. The reset prints fresh synthetic administrator credentials. Do not commit them.

## URLs

- Landing page: `http://127.0.0.1:3000/`
- Public event hub: `http://127.0.0.1:3000/events`
- Available event registration: use the `Reserve My Spot` card link from `/events`.
- Multi-date registration: use the recurring-series card link from `/events` after creating or
  publishing a synthetic weekly series.
- Confirmation: follow the token URL returned after a successful synthetic submission.
- Legal block: run `pnpm test:legal` or open a production-equivalent test page.
- Admin sign-in: `http://127.0.0.1:3000/admin/sign-in`
- System Admin dashboard: `http://127.0.0.1:3000/admin`
- Venue Administrator dashboard: sign in with the Organization A or B fixture.
- Invitations: `/admin/invitations`
- Attendance: `/admin/events`, then open a published event.
- Participant CRM: `/admin/participants`
- Follow-up queue: `/admin/follow-ups`

## Owner journey

- Open `/events` at a narrow mobile width. Confirm the branded fallback background, centered identity,
  stacked cards, readable long names, no horizontal overflow, and visible focus states.
- Open an available event and complete the form with keyboard-only navigation. Confirm labels,
  acknowledgment text, disabled submit state during submission, and a confirmation page.
- For a configured event, confirm the post-registration communication CTA appears only on the
  successful confirmation card, opens a new tab safely, and does not claim that the participant joined.
- For an event without a communication URL, confirm no CTA appears.
- For a recurring event, confirm only dates in the rolling 14-day window are offered and each selected
  date creates its own Registration.
- Sign in as each fixture administrator. Confirm System Admin global access and each Venue Admin's
  organization isolation. Attempt unrelated event URLs and global CRM routes.
- Use browser responsive mode and keyboard navigation. Emulate `prefers-reduced-motion: reduce` and
  confirm every critical action remains understandable without animation.

## Restore

Run `pnpm demo:reset` again to discard the synthetic local database and create a fresh demonstration
state. Never run it against a hosted project.

