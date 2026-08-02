# Pilot brand assets

Public branding is centralized in `src/lib/config/branding.ts`. Replace these static files to preview
new imagery locally:

- `public/brand/event-hub-background.svg`
- `public/brand/event-hub-background-mobile.svg`
- `public/brand/logo-mark.svg`

The typed configuration also controls desktop/mobile focal positions, overlay strength, fallback
background, organization/program name, tagline, and contact/social links. The public hub adopts the
reference characteristics of a centered identity, short tagline, narrow content column, stacked
rounded links, restrained icon row, background-led visual treatment, and subtle 120–200 ms feedback.
It intentionally keeps fitness-specific date/time, venue, availability, registration status, legal
clarity, and accessibility information visible rather than copying a generic link-page composition.

Desktop/tablet imagery should be approximately 2400×1600 px (3:2), ideally below 500 KB and no
larger than about 1 MB. Mobile imagery should be approximately 1440×1920 px (3:4), with the same
size targets. SVG or WebP is acceptable. Do not embed text in the image; keep the central 60% relatively
quiet, place the subject near the focal center, and preserve contrast beneath the UI overlay.

The hub uses `cover`, separate mobile/desktop assets, a readable overlay, and a gradient fallback when
an asset is absent. Restart or refresh the local app after replacing an asset. This remains the
static fallback workflow. DEC-053 additionally provides a protected System Admin Design Assets page
for approved non-sensitive uploads; static assets remain the safe fallback when no managed asset is active.

Recommended replacement workflow: use a desktop image near 2400×1600 and a mobile image near
1440×1920, preferably WebP or SVG below 500 KB and never above roughly 1 MB. Keep the focal subject
near the configured focal position with the central 60% quiet enough for text, then preview `/events`
at desktop and narrow mobile widths. Adjust `overlayStrength` or the focal-position fields in the
typed configuration when the card surfaces lose contrast; do not use continuous motion or animated
backgrounds.

## Current event descriptions

Descriptions are stored as plain text and rendered with React text escaping plus `whitespace-pre-wrap`.
They are not Markdown or raw HTML, and URLs are not automatically linked. A WhatsApp URL in a
description is therefore visible text, not a clickable communication CTA. This avoids XSS and unsafe
link behavior. The dedicated HTTPS communication-link field is the approved safe path for post-
registration group handoff.

## Event registration hero and admin roster visuals

Public event pages use the static category fallback configured in
`src/lib/config/admin-visual-assets.ts` (boxing, strength, yoga, community fitness, then
default). This is a typed local asset map: there is no image CMS, runtime image generation,
remote stock dependency, or database migration for visual styling. Replace the SVGs under
`public/admin-assets/event-cards/` with owner-provided or properly licensed assets when available.
Keep the subject near the center, use a cover-safe composition, and prefer optimized SVG/WebP
assets below roughly 500 KB (1 MB maximum).

The registration hero is approximately 58svh on small screens, uses a layered dark-to-page-surface
gradient, and keeps event identity/date/venue readable over the image. The icon-only back control
is visible near the hero and becomes non-tabbable and visually hidden once the top sentinel leaves
the viewport; reduced-motion users receive an immediate state change.

Admin event detail uses `RosterStatusCarousel` for progressive disclosure. Categories map only to
existing registration and attendance values: Registered, Attended, No-show, and Cancelled. The
focused dialog is a preview surface; the full roster table remains available below it for all
existing attendance corrections and permission checks.
