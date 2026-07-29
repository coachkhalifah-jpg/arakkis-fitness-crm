# Phase 7 — Event Publishing, Registration Links, QR Distribution & Admin Invitations

## Governance and status

This document implements the change-control documentation required by DEC-047. Phase 7 is an approved post-MVP scope extension and is not part of the originally frozen MVP under DEC-046. It is approved for planning and implementation only after this document and the synchronized requirements, business rules, acceptance tests, design, and traceability documents are reviewed. No Phase 7 application code, migration, or test is implemented by this document.

Starting baseline: `a79398d2466b7589772ba408393a25e325158e11`, tag `v0.9-crm-follow-up-complete`, migrations `0001–0019` unchanged.

## Why the phase was redefined

Phase 6 completed participant CRM and follow-up accountability. The older build plan placed that follow-up work in Phase 7, so that definition is now historical and superseded. Venue administrators need a safe participant-facing link that uses the existing registration, attendance, CRM, and follow-up system rather than an external form builder. QR codes support flyers and venue distribution, and secure invitation links simplify administrator onboarding without automated email. DEC-047 formally resolves the conflict without representing the extension as original MVP scope.

## Scope

Planned Phase 7 capabilities are canonical public event URLs, stable slugs, publication/unpublication, registration opening/closing and pause/resume, public availability states, link copying and preview, QR generation, and System Admin invitation-link creation, expiration, revocation, regeneration, acceptance, and constrained role/organization assignment. Local/staging/production behavior, audit, RLS, database enforcement, and the legal gate are part of the scope.

Series links are deferred. The current architecture has no approved competing series entity, so Phase 7 supports event-level links only: `/register/{public-slug}`.

## Canonical URL and environment model

`APP_BASE_URL` is resolved server-side. Local may default to `http://localhost:3000`; staging and production require an explicit valid HTTPS URL such as `https://events.example.com`. Trailing slashes are normalized. User-supplied Host headers are never authoritative. Public and invitation links never include authentication tokens or participant data. Missing or invalid non-local configuration fails closed.

Local is for development, reset, Playwright, and synthetic data. Staging is non-production, clearly labeled, restricted as configured, and uses synthetic or approved test data. Production registration remains blocked while the Participation acknowledgment is PROVISIONAL; the application must not infer legal readiness from the presence of production environment variables.

## Publication and availability

Publication is additive to the existing Event status. Planned publication states are `DRAFT`, `PUBLISHED`, and `UNPUBLISHED`; existing cancellation remains terminal and authoritative. A public page evaluates publication, event cancellation, organization/venue state, registration opening/closing, manual pause, capacity, and legal readiness independently. It presents safe states: not yet open, open, paused, closed, full, cancelled, unpublished, unavailable, and production legally blocked.

Publishing never bypasses capacity, deadlines, cancellation, organization/venue state, or the legal gate. Unpublishing does not change the slug or canonical URL. Knowing a URL never bypasses the same server/database availability checks.

## Slugs and public lookup

Slugs are generated from approved event information, normalized to lowercase URL-safe text, bounded in length, reserved-word protected, collision-safe, and free of participant data or sequential private identifiers. System Admin may adjust a slug; any permitted Host Admin adjustment is assigned-event scoped. A change requires warning and audit. Old-link behavior must be explicitly implemented and tested before changing a distributed slug.

The public lookup is a narrow projection or security-definer function with fixed `search_path`, minimum grants, and no broad anonymous table access. It returns only approved event name/description, host organization, venue, local date/time, instructions, capacity/availability, and legal/registration state. It does not return internal IDs, administrator details, participant data, private notes, audits, invitation tokens, unpublished details, or raw database errors.

## Link management and QR

The authenticated link-management view shows publication status, availability, slug, complete canonical URL, opening/closing times, capacity/full state, legal-gate state, last published time, and publishing actor where audited. Publish, unpublish, pause, resume, preview, copy, and QR actions are authorized mutations/reads; copy, preview, and QR generation have no publication or registration side effect. Copy feedback is accessible and clipboard contents are never stored.

QR generation produces an approved PNG or SVG with high contrast, printable resolution, a safe event-identifying filename, and an accessible text alternative. The encoded value is exactly the canonical public URL. It contains no private ID, participant data, administrator token, tracking parameter, or third-party analytics destination. Regeneration has the same destination and does not publish the event.

## Administrator invitation lifecycle

System Admin-only management creates a pending invitation with intended normalized email, approved role, required organization assignments, created actor/time, expiration, and audit state. The token is cryptographically random, high entropy, single-use, and stored only as a hash. The raw URL is displayed once at creation or regeneration for private distribution; Phase 7 sends no email. The UI explains expiry, single-recipient use, private handling, normal `/login` use after activation, and revocation if exposed.

Pending invitations can expire, be revoked, or be regenerated. Regeneration creates a new hash and expiration and invalidates the old token. Acceptance verifies authenticated identity and normalized email equality, creates or links the Auth user, copies only the invitation’s role and assignments, activates the administrator transactionally or through a documented recoverable boundary, and consumes the invitation. Invitees cannot alter assignments. Existing accounts are linked only after authentication; email input alone never proves ownership. Conditional locking/unique constraints make repeated or concurrent acceptance create at most one profile and assignment set.

## Authorization

System Admin has global publication, link, QR, and invitation authority. Host Admin management access is denied by default for invitation management; if event publication actions are enabled, they are limited to assigned host organizations and eligible events. Unassigned Host Admins, inactive administrators, authenticated non-admins, and anonymous users cannot access management data or mutations. Public visibility does not grant management authority. RLS and server/data-access checks both enforce this boundary.

## Legal gate

Local synthetic registration is allowed for development and testing. Staging is non-production and may be enabled only under an explicit synthetic/test configuration. Production participant registration is denied before participant data submission while the Participation acknowledgment is PROVISIONAL. The UI, server action, and database/RPC all enforce the gate; a modified request or direct RPC cannot bypass it. Phase 7 does not approve legal text, represent provisional text as approved, authorize deployment, or enable real production registration.

## Database, RLS, grants, and migrations

Migrations begin after `0019`; migrations `0001–0019` are immutable. Planned additions include publication metadata, public slug uniqueness, registration window/pause fields, a narrow public lookup, and invitation lifecycle/audit refinements. Every new table/view/function/trigger uses RLS where applicable, controlled `search_path`, minimum grants, no anonymous management access, no raw-token reads, and server-side legal/publication authorization. Public lookup is a narrowly scoped projection/function. Audit rows record actor, timestamp, subject, organization, and prior/new state without raw tokens.

## Traceability and planned validation

| Scope | Requirements | Rules | Acceptance | Planned validation |
|---|---|---|---|---|
| Publication and availability | FR-087, FR-090–FR-092, FR-100–FR-104 | BR-114, BR-117–BR-122, BR-128–BR-130 | AT-099, AT-102–AT-105, AT-114–AT-121, AT-124, AT-128–AT-131 | Unit status/URL tests; database/RLS states; Playwright share/availability/legal flows |
| Slugs and canonical URLs | FR-088–FR-089, FR-094 | BR-115–BR-120 | AT-100–AT-103, AT-115, AT-119–AT-123 | Unit normalization/collision/URL tests; public lookup assertions |
| QR distribution | FR-093 | BR-118–BR-119 | AT-104–AT-105, AT-122–AT-123 | QR decode/content tests; accessible component test; browser download flow |
| Invitations | FR-095–FR-101 | BR-123–BR-127 | AT-106–AT-113, AT-125–AT-127 | Token unit/database tests; Auth integration; invitation Playwright and concurrency tests |
| Security/audit | FR-096, FR-101–FR-104 | BR-121–BR-130, BR-134–BR-136 | AT-107, AT-113–AT-118, AT-124, AT-128–AT-131 | RLS, grants, audit, secret/artifact review; two clean-reset validations |
| Boundaries | FR-105 | BR-131–BR-133 | AT-132 | Scope review and staged-diff review |

All Phase 7 validations are planned/pending. Phase 1–6 tests and behavior remain regression requirements.

## Testing strategy

Planned unit/component coverage includes slug normalization and collisions, canonical URL construction, availability/legal-state rendering, copy feedback, QR payload/filename/accessibility, invitation status/expiry/revocation, safe errors, loading/repeated submissions, role/assignment controls, and mobile/keyboard behavior.

Planned database/integration coverage includes publication lifecycle, narrow public lookup, registration windows/pause/full/cancelled/legal states, slug uniqueness and changed-link behavior, canonical base URL validation, hash-only invitations, expiration/revocation/regeneration/single use, existing-account behavior, concurrent acceptance, role/assignment correctness, RLS isolation, audit evidence, and direct legal-gate/RPC denial.

Planned Playwright coverage includes publish/share/unpublish, each availability state, QR generation and decoded destination, System Admin invitation creation/acceptance/reuse/revocation/regeneration, cross-organization denial, inactive/non-admin/anonymous denial, and legal gating. Two clean resets must regenerate synthetic Auth identities, fixtures, and browser state before the complete Phase 1–7 validation. No Phase 7 tests are implemented yet.

## Explicit exclusions and remaining limitations

Excluded are automated email, SMS, WhatsApp, or push messaging; participant accounts/login; participant merging; analytics dashboards; tracking links and QR analytics; payments; production deployment; legal approval; and Phase 8 work. No series link model is introduced. No external form builder is approved. Phase 7 does not send invitations; administrators privately distribute copied links.

## Completion state

Documentation synchronization is the only completed work in this phase transition. Application implementation, migrations after `0019`, Phase 7 tests, deployment, legal approval, and the `v1.0-publishing-links-complete` tag remain pending. Phase 7 implementation is authorized to begin only after this document and all linked source-of-truth updates are accepted.
