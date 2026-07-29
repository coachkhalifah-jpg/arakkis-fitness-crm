# Contributing

Use `codex/<phase-or-task>` branches and focused commits. Pull requests must state requirement IDs,
changed files, tests run, migration impact, authorization/privacy review, accessibility review, and
known risks. Run `pnpm validate` plus relevant database/browser gates before requesting review.

Create a new ordered migration for schema changes; never edit applied migrations or make unreconciled
dashboard changes. Do not commit `.env*` local files, keys, tokens, passwords, generated credentials,
or machine-specific paths. Service-role credentials stay server-side. Production changes require
owner authorization and a reviewed rollback plan; direct unreviewed dashboard changes are prohibited.

Update the relevant handoff/runbook and acceptance ledger when operational behavior changes. Release
tags are created only after all required evidence passes. Reviewers prioritize organization isolation,
RLS, capacity/duplicate concurrency, legal gate, auditability, secret handling, and accessibility.
