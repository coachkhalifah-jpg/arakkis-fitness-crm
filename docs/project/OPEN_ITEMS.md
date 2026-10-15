# Open items

Only unresolved, deferred, accepted, or decision-pending items are listed here. Corrected J5 defects are not open.

## Product

- Public registration UX improvements remain deferred for Product Owner/UI review; core public registration is implemented.
- Google OAuth and X/Twitter OAuth are not implemented; administrator authentication remains email/password through Supabase Auth.

## Engineering / Technical Debt

- Legacy permission documents conflict with the validated assigned-Organization Host Admin Venue create/update model. Canonical documents record the current model; formal synchronization of the legacy documents remains pending.
- Local Playwright uses a shared synthetic database and one worker; parallel workers are not supported by the current fixture design.
- `participants.goals` remains nullable (DEC-061 restores optional public collection; a destructive column drop is still deferred until an approved decision).
- Draft take-home workout timer PR (#33) used migration number `0076`, which collides with tip `0076_phone_only_participant_match.sql` (and tip now runs through **0080**). Consolidation renumbers the timer migration to **0081**; close or supersede #33 when that lands.
- HOLD UAT-004 / UAT-005 / UAT-007 remain parked pending Product Owner reopen.
- Participant restore/un-archive UI after DEC-069 soft-archive is deferred until Product Owner requests it.

## UI / UX

- A shared UI/UX design system is not yet established. Forms, buttons, toggles, cards, typography, spacing, success/error states, accessibility, and interaction patterns need a coordinated product-design pass.

## Deployment / Operations

- Hosted Supabase/Vercel deployment, hosted Auth configuration, domain setup, monitoring, backup/PITR confirmation, restore rehearsal, and rollback rehearsal remain incomplete.
- No production backup or rollback claim can be made from local validation alone.

## Legal / Compliance

- Production registration is intentionally blocked until the Participation acknowledgment is legally approved.
