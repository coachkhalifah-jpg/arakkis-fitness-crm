# Current roadmap

## Event Management — Complete

Validated Event creation is atomic and idempotent, including recurring Events, validation, authorization, draft/publish behavior, Event images, signed replacement intent, rollback/cleanup/audit behavior, and Admin Workspace/route authorization corrections. Baseline: `28b63d68b58a0a310e1811d6b29e88da745790af`.

## Registration — Complete / Deferred UX

Core public registration, multi-date selection, partial success, capacity/deadline checks, confirmation, calendar links, legal gates, and remembered-device safeguards are implemented and locally validated. Remaining registration UX improvements are deferred for Product/UI review.

## Organizations & Venues — Complete / Documentation Sync Open

Organizations are System Admin-only. System Admins have global Venue management; Host Admins have assigned-Organization Venue read/create/update scope; Venue archive is System Admin-only. Direct routes, server actions, and RLS enforce the model. Legacy documentation synchronization remains open.

## Attendance — Complete / Hosted Validation Pending

Attendance opening, check-in, walk-ins, finalization, corrections, capacity protections, immutable transitions, and cancellation interactions are implemented and locally validated. Hosted validation remains pending.

## Participant CRM / Follow-up — Complete / Hosted Validation Pending

Global participant identity, affiliation/history distinctions, indicators, notes/privacy boundaries, idempotent follow-up creation, and manual follow-up workflows are implemented and locally validated. Hosted validation remains pending.

## Publishing / Links / Invitations — Complete Locally / Hosted Validation Pending

Publication states, stable slugs, availability controls, canonical links, QR distribution, and invitation lifecycle are implemented/documented locally. Hosted Auth, URL, and deployment evidence is not complete.

## UI / UX Design System — Not Started

A coordinated UI/UX design system is not yet established. The next major product-improvement initiative should define reusable standards for forms, buttons, toggles, cards, typography, spacing, success/error states, accessibility, and interaction behavior across pages.

## Deployment / Pilot Readiness — In Progress / Blocked for Production

Local synthetic pilot validation and the private GitHub backup are complete. Hosted staging validation, backups/PITR, restore and rollback rehearsal, monitoring, domain/Auth configuration, and owner-controlled deployment remain in progress. Production registration is blocked until legal approval of the Participation acknowledgment.

## Recommended sequence

1. Complete Product Owner review of the canonical operating documents.
2. Synchronize the legacy Venue-permission documents through a formal decision/document update.
3. Run owner-controlled staging migration, Auth, backup, monitoring, legal-gate, and smoke validation.
4. Complete journey-based UAT and sign-off.
5. Start the shared UI/UX design-system initiative as a separate product-improvement stream.
