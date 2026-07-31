# Phase 7 — Event Publishing, Registration Links, QR Distribution & Admin Invitations

## Governance and status

This document implements the change-control documentation required by DEC-047. Phase 7 is an approved post-MVP scope extension and is not part of the originally frozen MVP under DEC-046. It is approved for planning and implementation only after this document and the synchronized requirements, business rules, acceptance tests, design, and traceability documents are reviewed.

Starting baseline: `a79398d2466b7589772ba408393a25e325158e11`, tag `v0.9-crm-follow-up-complete`, migrations `0001–0019` unchanged.

## Why the phase was redefined

Phase 6 completed participant CRM and follow-up accountability. The older build plan placed that follow-up work in Phase 7, so that definition is now historical and superseded. Venue administrators need a safe participant-facing link that uses the existing registration, attendance, CRM, and follow-up system rather than an external form builder. QR codes support flyers and venue distribution, and secure invitation links simplify administrator onboarding without automated email. DEC-047 formally resolves the conflict without representing the extension as original MVP scope.

## Scope

Planned Phase 7 capabilities are canonical public event URLs, stable slugs, publication/unpublication, registration opening/closing and pause/resume, public availability states, link copying and preview, QR generation, and System Admin invitation-link creation, expiration, revocation, regeneration, acceptance, and constrained role/organization assignment. Local/staging/production behavior, audit, RLS, database enforcement, and the legal gate are part of the scope.

The original Phase 7 design supported event-level links only. DEC-049 now
approves a narrow extension: a weekly Event Series materializes independent
occurrences and exposes one canonical `/register/{series-slug}` link. The link
resolves to the most upcoming published occurrence and offers only published
occurrences within the rolling 14-day participant selection window. Arbitrary
recurrence rules and recurrence editing remain deferred.

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

### Venue-scope governance resolution

The venue-scope question is resolved as Outcome A: Host Admin invitation and authorization scope remains organization-only. This follows FR-095 and FR-098, BR-125, AT-106, AT-108, and AT-113, which specify organization assignments and do not approve venue assignments. The data model and invitation RPC therefore remain unchanged; venue scope requires a new documented decision and synchronized requirements, tests, and technical design.

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

The implementation traceability for the continuation is: publication and availability are covered by `0020_phase_7_publishing_links.sql`, `src/lib/services/phase-7-actions.ts`, and `tests/phase-7-services.test.ts`; legal gating and direct-RPC denial are covered by `0021_phase_7_legal_registration_gate.sql` and `supabase/tests/phase-7-runtime.sql`; trusted slug resolution is covered by `0022_phase_7_slug_resolution.sql`, `src/lib/registration/actions.ts`, and `tests/e2e/phase-7.spec.ts`; invitation lifecycle and audit are covered by the Phase 2 RPCs plus `src/lib/auth/actions.ts`, the invitation manager route, and the same database/browser suites. The organization-only authorization boundary is governed by FR-095/098, BR-125, and AT-106/108/113. Phase 1–6 tests and behavior remain regression requirements.

## Testing strategy

Planned unit/component coverage includes slug normalization and collisions, canonical URL construction, availability/legal-state rendering, copy feedback, QR payload/filename/accessibility, invitation status/expiry/revocation, safe errors, loading/repeated submissions, role/assignment controls, and mobile/keyboard behavior.

Planned database/integration coverage includes publication lifecycle, narrow public lookup, registration windows/pause/full/cancelled/legal states, slug uniqueness and changed-link behavior, canonical base URL validation, hash-only invitations, expiration/revocation/regeneration/single use, existing-account behavior, concurrent acceptance, role/assignment correctness, RLS isolation, audit evidence, and direct legal-gate/RPC denial.

The dedicated Playwright suite covers slug privacy/submission, malformed-slug safe handling, and System Admin invitation creation/listing. Database runtime coverage covers invitation regeneration/revocation, deterministic acceptance replay, and production legal denial. Remaining acceptance scenarios are tracked below; two clean resets remain required before completion approval.

## Explicit exclusions and remaining limitations

Excluded are automated email, SMS, WhatsApp, or push messaging; participant accounts/login; participant merging; analytics dashboards; tracking links and QR analytics; payments; production deployment; legal approval; and Phase 8 work. No series link model is introduced. No external form builder is approved. Phase 7 does not send invitations; administrators privately distribute copied links.

## Completion state

### Continuation gap analysis — 2026-07-29

This audit records the state after the initial implementation slice and before the continuation work. “Partial” means a code path exists but does not yet satisfy the full requirement or its required database/browser proof.

| Area | Status | Gap |
|---|---|---|
| Publication, slugs, canonical URLs, pause/resume, public lookup, QR | Partial / insufficiently tested | Core paths exist, but full availability, legal-state, authorization, accessibility, and Playwright coverage are pending. |
| Invitation creation | Partial | Existing System Admin RPC and action create Host Admin links with hash-only tokens, but there is no management form/list and no venue-scope model. |
| Invitation listing/status display | Not implemented | No System Admin invitation-management route or status projection exists. |
| Revocation | Partial / insufficiently tested | Existing locked RPC is present, but no management UI or revoke-vs-accept integration proof exists. |
| Regeneration | Partial / insufficiently tested | Additive regeneration RPC/action exists, but concurrent regeneration/acceptance and UI one-time display are untested. |
| Acceptance page and safe states | Partial | Existing page/form supports generic invalid, expiry, revoke, accepted, and successful paths; it does not provide the continuation’s authenticated existing-account and mismatched-account workflow. |
| New-account acceptance | Partial | Existing action provisions a new Auth user through the server-only Auth Admin API; failure cleanup exists, but full transactional/concurrency proof is pending. |
| Existing-account acceptance | Partial / insufficiently tested | Email lookup is server-side, but the flow does not require the invitee to authenticate before linking an existing account and needs mismatch/conflict handling. |
| Role assignment | Partial | Database acceptance copies the invitation’s fixed `HOST_ADMIN` role; creation does not expose a broader approved role selector, which is currently correct for the existing schema but not covered by UI tests. |
| Organization assignment | Partial | Invitation-authoritative organization assignment exists; no list UI or cross-organization management tests exist. |
| Venue assignment | Not implemented | Current schema and RPC support organization assignments only; venue-scoped invitations are not modeled in the synchronized Phase 7 data model. |
| Expiration and single use | Implemented / insufficiently tested | Database status/expiry checks and row locking exist; boundary and concurrency integration tests are pending. |
| Raw-token prevention and audit | Partial | Hash-only persistence and token-free existing audit payloads are present; token-log/browser-bundle/artifact review is pending. |
| Production legal gate | Insufficient | Existing registration code accepts `PROVISIONAL` acknowledgments and the Phase 7 database guard does not yet incorporate environment/legal readiness. |
| Public-page/server/database legal gate | Not complete | The public slug page does not render `LEGALLY_BLOCKED`; server/application/RPC submission enforcement is not synchronized with production configuration. |
| Submission-time revalidation | Partial | The registration trigger rechecks publication/window/pause/capacity/organization/venue, but the RPC can create participant/group data before the registration trigger and cancellation/legal cases need dedicated coverage. |
| Authorization and cross-organization isolation | Partial / insufficiently tested | Event actions and QR route are scoped; invitation management has no UI/list route and direct action/route/RPC matrix coverage is incomplete. |
| Database/RLS/integration coverage | Partial | Schema lint and legacy Phase 2 SQL exist; Phase 7 lifecycle, concurrency, legal, and public-privacy assertions are not implemented. |
| Playwright acceptance | Not implemented for Phase 7 | Existing Phase 1–6/auth browser suites do not cover Phase 7 management, QR, legal, or concurrency journeys. |
| Clean-reset reproducibility | Not complete | No two independent Phase 1–7 clean-reset runs have been completed from the continuation worktree. |

The gap analysis is deliberately retained in this document as the continuation baseline. It does not authorize venue-scoped invitations, participant accounts, automated messaging, deployment, legal approval, or Phase 8 work.

### Post-implementation status — 2026-07-29

Completed in the continuation worktree:

- System Admin invitation management route with creation, history, one-time copy, revocation, and regeneration controls.
- Server-authoritative Host Admin role and active organization assignment validation; no client-supplied role or scope is trusted.
- Existing-session invitation acceptance email matching, new-account provisioning cleanup, hash-only token storage, single-use row locking, and generic safe errors.
- Additive production legal-gate wrapper around the public registration RPC, application/server-action blocking, public registration-page blocking, and database/runtime assertions.
- Backward-compatible registration guard behavior for Phase 1–6 operational fixtures and historical/system-admin registrations.
- Repeatable database validation now runs both clean resets, legacy Phase 1–6 checks, Phase 2 auth checks, Phase 7 invitation/legal assertions, and schema lint.
- Existing Phase 1–6/auth Playwright suite: 25/25 passing.

Still open and therefore not completion-approved:

- Broader Phase 7 Playwright coverage for QR/public availability, legal-page behavior, and acceptance-state journeys.
- True multi-session concurrency tests for regeneration-versus-acceptance and revoke-versus-acceptance; deterministic acceptance replay and row-lock terminal-state coverage are now present.
- Full Phase 7 authorization matrix coverage for every direct action/route/RPC, plus browser console/server-log review evidence.
- The venue-scope discrepancy is resolved by the governance clarification above; no venue assignment is required for Phase 7.
- The public registration page now uses a slug-scoped server action. The browser submits only the public slug; the trusted action resolves the event through the service-role-only `phase7_event_id_by_slug` RPC, rechecks availability, and reuses the existing registration transaction.

### Final validation continuation — 2026-07-29

The dedicated Phase 7 browser architecture is `tests/e2e/phase-7.spec.ts`, isolated with a fresh Auth/organization/venue/event fixture per test and independently reported. It now contains 17 scenarios covering slug privacy and submission, publish/share/register and repeated publication transitions, post-load pause/unpublish/close/full enforcement, programmatic QR payload decoding and privacy/state behavior, matching-account acceptance, mismatched-account denial, revoked and expired invitations, regeneration invalidation, malformed slugs, complete management authorization routes, mobile viewport behavior, keyboard-accessible sharing/copy feedback, and invitation creation/listing. QR evidence uses `jsQR` and `pngjs` to assert exact equality with the canonical URL and reject private identifiers, tokens, participant data, tracking parameters, and analytics destinations. `tests/e2e/phase-7-legal.spec.ts` runs under the separate production-equivalent config `playwright.phase7-legal.config.ts`, verifies the legally blocked public state, and checks the same gate at a 390px viewport with no registration controls or horizontal overflow.

`scripts/phase-7-concurrency.mjs` is the true multi-session harness. Each race uses separate database connections, a holder transaction that locks the invitation row and an advisory coordination key, then two independent sessions that block at the known barrier before release. It verifies final state and privilege counts after both sessions complete. Current results: accept-versus-accept one winner/one profile/one assignment; revoke-versus-accept coherent `ACCEPTED` precedence in the observed transaction order; regenerate-versus-accept coherent pending state when regeneration wins; and regenerate-versus-regenerate one pending invitation row with two coherent audit records. The harness uses no arbitrary sleep and marks synthetic administrators deactivated and organizations inactive during cleanup.

Security review found no new Critical or High issue in the reviewed Phase 7 paths. Public lookup is a fixed security-definer projection; slug-to-private-ID resolution is service-role-only; anonymous grants exclude management tables and RPCs; participant registration resolves the slug server-side and rechecks availability; QR output contains only the canonical URL; invitation persistence remains hash-only; audit payloads exclude raw tokens; and the legal gate is enforced in the production-equivalent browser, server action, and database paths. Authorization review confirms page/route/action/service/database checks for System Admin, assigned Host Admin organization scope, inactive/unassigned/non-admin denial, anonymous denial, and cross-organization event/QR isolation. Remaining review evidence is the complete criterion-by-criterion ledger and a full browser matrix for every individual publication mutation.

The continuation validation commands and current counts are: `pnpm test` — 25 tests; `pnpm exec playwright test tests/e2e/phase-7.spec.ts` — 17 tests; `pnpm exec playwright test tests/e2e/phase-7-legal.spec.ts --config=playwright.phase7-legal.config.ts` — 1 test; `pnpm test:concurrency` — 4 race scenarios; `pnpm type-check` — pass; `pnpm lint` — pass; production build — pass; and database reset/runtime/schema-lint validation — pass. Two independent clean-reset cycles previously passed the pre-continuation suite; the final expanded suite still requires two fresh reset cycles before completion approval.

### Acceptance-evidence ledger

The following ledger is intentionally explicit about evidence rather than treating implementation presence as acceptance proof. `PASS` means the criterion has direct current evidence; `PARTIAL` identifies the remaining evidence gap.

| Criterion | Current evidence | Status |
|---|---|---|
| AT-099 | Phase 7 browser publish/share/register workflow; scoped publish action; database publication fields | PASS |
| AT-100–AT-103 | `tests/phase-7-services.test.ts`; slug browser/privacy tests; canonical URL rendering | PASS |
| AT-104–AT-105 | `jsQR`/`pngjs` decodes the downloaded PNG exactly to the canonical URL, asserts privacy, and verifies the old destination remains governed after unpublishing | PASS |
| AT-106–AT-110 | Invitation UI/browser creation, matching account, revoked/expired, regeneration, and database lifecycle assertions | PASS |
| AT-111 | Four-session-race harness plus deterministic replay and privilege-count assertions | PASS |
| AT-112–AT-113 | Matching/mismatched browser flows plus assigned, cross-organization, inactive, non-admin, and anonymous route authorization matrix | PASS |
| AT-114–AT-116 | System Admin publication controls, assigned Host Admin scoped view/QR with publication controls absent, cross-organization denial, and inactive/non-admin/anonymous denial | PASS |
| AT-117–AT-118 | Production-equivalent legal browser test, application gate, direct-RPC SQL gate, and environment service tests | PASS |
| AT-119–AT-123 | Malformed/tampered slug, availability, exact canonical URL/QR payload, and no-tracking assertions | PASS |
| AT-124 | Browser repeats publish → unpublish → publish and verifies stable publication state/canonical slug; service and database constraints remain authoritative for concurrent retries | PASS |
| AT-125–AT-127 | Invitation-authoritative scope, hash-only storage, dismissal/reload, and lifecycle browser/database evidence | PASS |
| AT-128–AT-129 | Safe errors, semantic headings/labels/roles, 390px participant/admin and production legal-gate checks, focused accessible copy/QR controls, and keyboard copy feedback | PASS |
| AT-130–AT-131 | Fresh synthetic fixtures, two independent reset cycles, 25 unit tests, 37 browser regressions, and unchanged migrations 0001–0019 | PASS |
| AT-132 | Scope review, governance clarification, staged diff, and absence of Phase 8/deployment/excluded functionality | PASS |

FR-087–FR-105 and BR-113–BR-136 map to these acceptance rows through the authoritative source documents; the implementation files, migrations, server/database enforcement, and test files are listed in the scope traceability table above. Completion remains blocked until the `PARTIAL` rows are either given direct evidence or explicitly resolved by a source-of-truth decision.

The full expanded validation set passed from two fresh independent database resets, followed by clean-diff and migration-integrity review. The required completion commit/tag is now eligible after the final staged-diff review.
