# Open items

Only unresolved, deferred, accepted, or decision-pending items are listed here. Corrected J5 defects are not open.

## Product

- Public registration UX improvements remain deferred for Product Owner/UI review; core public registration is implemented.
- Google OAuth and X/Twitter OAuth are not implemented; administrator authentication remains email/password through Supabase Auth.

## Engineering / Technical Debt

- Legacy permission documents conflict with the validated assigned-Organization Host Admin Venue create/update model. Canonical documents record the current model; formal synchronization of the legacy documents remains pending.
- Local Playwright uses a shared synthetic database and one worker; parallel workers are not supported by the current fixture design.

## UI / UX

- A shared UI/UX design system is not yet established. Forms, buttons, toggles, cards, typography, spacing, success/error states, accessibility, and interaction patterns need a coordinated product-design pass.

## Deployment / Operations

- Hosted Supabase/Vercel deployment, hosted Auth configuration, domain setup, monitoring, backup/PITR confirmation, restore rehearsal, and rollback rehearsal remain incomplete.
- No production backup or rollback claim can be made from local validation alone.

## Legal / Compliance

- Production registration is intentionally blocked until the Participation acknowledgment is legally approved.
