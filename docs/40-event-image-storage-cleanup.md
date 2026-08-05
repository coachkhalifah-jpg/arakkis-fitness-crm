# Local Event Image Storage Cleanup

The orphan inventory is local-only and dry-run by default. It reports every object in the
`design-assets` bucket, joins paths to `design_assets` metadata and audit counts, extracts staging
request/Event IDs where present, and classifies unreferenced objects. Referenced objects and recent
unreferenced objects are retained.

Run a dry run:

```sh
npm run audit:event-images
```

The default minimum age is 24 hours. To review or remove confirmed candidates in local Supabase,
use an explicit zero-age review and delete command:

```sh
EVENT_IMAGE_ORPHAN_MIN_AGE_HOURS=0 node scripts/audit-event-image-storage.mjs
EVENT_IMAGE_ORPHAN_MIN_AGE_HOURS=0 node scripts/audit-event-image-storage.mjs --delete-confirmed
```

Deletion refuses production or non-local Supabase URLs, excludes every object referenced by
`design_assets`, uses the Storage API, and reports only counts/paths—not credentials. Ambiguous
objects are never deleted automatically.
