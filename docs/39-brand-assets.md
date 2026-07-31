# Pilot brand assets

Public branding is centralized in `src/lib/config/branding.ts`. Replace these static files to preview
new imagery locally:

- `public/brand/event-hub-background.svg`
- `public/brand/event-hub-background-mobile.svg`
- `public/brand/logo-mark.svg`

Desktop/tablet imagery should be approximately 2400×1600 px (3:2), ideally below 500 KB and no
larger than about 1 MB. Mobile imagery should be approximately 1440×1920 px (3:4), with the same
size targets. SVG or WebP is acceptable. Do not embed text in the image; keep the central 60% relatively
quiet, place the subject near the focal center, and preserve contrast beneath the UI overlay.

The hub uses `cover`, separate mobile/desktop assets, a readable overlay, and a gradient fallback when
an asset is absent. Restart or refresh the local app after replacing an asset. This is a static-file
workflow, not a media-upload CMS.

## Current event descriptions

Descriptions are stored as plain text and rendered with React text escaping plus `whitespace-pre-wrap`.
They are not Markdown or raw HTML, and URLs are not automatically linked. A WhatsApp URL in a
description is therefore visible text, not a clickable communication CTA. This avoids XSS and unsafe
link behavior. The dedicated HTTPS communication-link field is the approved safe path for post-
registration group handoff.
