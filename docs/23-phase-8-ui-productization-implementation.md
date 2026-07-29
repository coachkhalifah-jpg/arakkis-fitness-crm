# Phase 8 — UI/UX Productization Implementation

Status: implementation complete; validation recorded in `docs/24-phase-8-acceptance-ledger.md`.

## Starting point and scope

Phase 8 continues the published-link application from `v1.0-publishing-links-complete`. The work is presentation-layer focused: a mobile-first participant journey, an `/events` discovery destination, reusable visual primitives, and a calmer administrator shell. No migrations, business rules, permissions, registration behavior, or Phase 7 security controls were changed.

Excluded from this phase: deployment, payments, automated messaging, participant accounts, analytics, and Phase 9 work.

## Design approach

The experience uses Linktree-inspired direct discovery, boutique fitness presentation, and generous Airbnb-like spacing without copying any external product. The visual language is warm and restrained: evergreen brand actions, sand surfaces, coral schedule accents, rounded cards, soft shadows, and concise status language.

Typography uses a system-first sans-serif stack so pages render without a remote font dependency. Responsive behavior is mobile-first: content is single-column by default, cards and forms expand at tablet/desktop breakpoints, and primary actions retain comfortable touch targets.

## Public participant architecture

- `/` is a welcoming entry point with two clear paths: `/events` discovery and `/registration` schedule registration.
- `/events` reads the existing `public_event_schedule` projection and orders cards by `starts_at`. Each card contains only approved public event data and links to `/register/{public-slug}` when available.
- `/register/{slug}` continues to resolve event data through the existing Phase 7 RPC and renders the existing registration action path.
- `/registration` continues to use multi-date selection and the existing server action/RPC.
- `/registration/confirmation` remains token-scoped and offers the existing calendar downloads.

## Component inventory

| Component | Path | Purpose / variants | Consumers and accessibility |
|---|---|---|---|
| Button | `src/components/ui/button.tsx` | Primary action, disabled state via native button props | Admin actions; keyboard focus and disabled semantics are native |
| Card | `src/components/ui/card.tsx` | Shared white rounded content surface | Public/admin pages; content remains fluid and readable |
| Badge | `src/components/ui/badge.tsx` | Compact status/category label; class override supported | Home, events hub, admin role; text is never color-only |
| EmptyState | `src/components/ui/empty-state.tsx` | Encouraging empty content with optional authorized CTA | `/events`, `/registration`; heading and descriptive text are semantic |
| SectionHeader | `src/components/ui/section-header.tsx` | Eyebrow, page title, optional description | Public registration and events hub; preserves heading hierarchy |
| RegistrationForm | `src/components/registration/registration-form.tsx` | Existing server-action form with polished fields, event selection, acknowledgments, pending/error state | Participant registration; labels, required controls, native validation, and alert status |
| Navigation | `src/components/navigation.tsx` | Public brand navigation and admin entry point | Landmark navigation with named links; mobile hides only secondary discovery text |

Legacy page-specific class strings remain in admin detail/list pages and confirmation screens. They are intentionally not broadly refactored in Phase 8 because those pages contain operational workflows; future consolidation should be incremental and behavior-preserving.

## Loading, empty, and error states

The global loading boundary now uses a low-motion-neutral skeleton with `aria-busy` and a screen-reader loading message. Public no-event states use `EmptyState`; unavailable slugs remain a concise status card; the production legal gate remains enforced by the existing configuration and database controls. Native pending submit state disables the registration action and changes its label to `Submitting…`.

## Accessibility and performance decisions

Global `:focus-visible` styles provide a consistent visible keyboard indicator for links, buttons, and form controls. Forms use explicit/implicit labels, required native controls, readable acknowledgment text, and `role=alert` for submission errors. Status labels include text, not only color. No new client-side data fetching or image/font dependency was introduced; `/events` and public event pages remain server-rendered, while only the existing registration form is client-side for server-action state.

## Browser coverage

`tests/e2e/phase-8.spec.ts` covers landing-to-events navigation, event card canonical links, privacy of public markup, participant completion to confirmation, keyboard-operated submission, narrow mobile overflow, and invalid-slug handling. Existing Phase 7 suites continue to cover publishing, pause/unpublish/close guards, canonical links, QR output, invitations, authorization, and legal blocking.

## Known limitations

The current repository has no dedicated visual snapshot baseline or automated axe dependency. Browser assertions cover semantic roles, labels, focusable controls, canonical links, overflow, and the legal/unavailable states without adding a large testing dependency. The event hub displays the states exposed by the existing public projection; paused, closed, unpublished, and legal-gate detail rendering remain covered by the established Phase 7 tests and are not fabricated into the public discovery list.

## Final validation record

The exact command results and acceptance mapping are maintained in `docs/24-phase-8-acceptance-ledger.md`. Completion requires both clean-reset cycles and the repository/runtime gates to pass before the Phase 8 completion commit and tag are created.
