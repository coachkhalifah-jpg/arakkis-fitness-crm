# Admin visual assets

These local, project-owned SVG placeholders keep the administrator workspace usable without remote image dependencies. Replace an image by keeping the same filename in its folder; SVG or WebP is fine if the configured path is updated in `src/lib/config/admin-visual-assets.ts`.

Page backgrounds: 2400 × 1600, 3:2, sRGB, ideally under 700 KB and no larger than about 1 MB. Keep the center quiet, avoid embedded text, and use a subject that remains legible beneath the gray/soft-white overlay.

Event cards: 1600 × 900, 16:9, sRGB, ideally under 400 KB and no larger than about 700 KB. Keep the subject near the center and leave contrast for the title treatment.

To preview locally, retain the filename, refresh or restart the local Next.js server, and inspect the admin pages at mobile and desktop widths. Adjust `focalPositions` or `overlayStrength` in the typed configuration when a replacement image needs repositioning or a stronger veil. Do not add remote URLs or unlicensed stock imagery.
