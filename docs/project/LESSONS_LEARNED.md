# Lessons learned

- Idempotency must compare stable logical business intent, not generated UUIDs, staging paths, or insertion order.
- QA needs a fixed acceptance boundary; it must not silently create product requirements.
- Explicitly approved and documented Product Owner decisions override inferred or legacy requirements.
- Server authorization and RLS are authoritative; hidden navigation is not security.
- Storage cleanup debt is not automatically a release blocker when committed business state is correct, cleanup is observable, and safe remediation exists.
- Test resets must clean external Storage state before deleting database references.
- Reproduce defects before implementing fixes whenever practical.
- Prefer vertical slices over broad page-based batches.
- Separate bugs, workflow improvements, and UI/UX changes.
- Use targeted regression first and broader regression only when risk justifies it.
- UI/UX standards should be reusable across components and pages, not solved page by page.
- Confirmation “Add to calendar” cards must reuse the shared participant EventCard shell (`event-card-shell` / `participant-event-card`), not a one-off confirmation-calendar card language (UAT-010).
- Event card hero titles (`.event-card-title-overlay`) must not use `line-height` below ~1.1 while `-webkit-line-clamp` / `overflow: hidden` is on — tight line boxes clip descenders and baselines on heavy display type (Fight Night card clip). Prefer padding-block inside the overflow box over relying on parent inset alone.
- Published Event capacity must remain editable under DEC-009 / FR-005 (floor = active registrations). Do not put `capacity` in `enforce_event_phase_3_guards` post-DRAFT immutability; schedule/venue/ownership stay immutable. Opaque `42501` → “cannot be edited in its current state” hid this (pilot Manage Event capacity 10→15).
- Manage Event Update must not rewrite `starts_at` / `ends_at` / `registration_deadline` / `timezone` / host / venue for non-DRAFT rows from datetime-local round-trips or current venue timezone — that false-diff retriggers published-field immutability even on capacity-only saves. Prefer omitting those columns from the UPDATE patch after publish (do not re-SET old values).
- Hosted capacity edits need the DB guard rewrite applied (`0087` hard replace). App-only deploys still fail with the same immutability message if `enforce_event_phase_3_guards` still compares `capacity`.
- Keep stable project context in canonical documents instead of repeatedly embedding it in prompts.
