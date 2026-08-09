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
- Keep stable project context in canonical documents instead of repeatedly embedding it in prompts.
