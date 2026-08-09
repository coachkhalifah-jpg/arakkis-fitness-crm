# Release checklist

## Scope and source

- [ ] Review `PROJECT_STATE.md`, `CURRENT_ROADMAP.md`, and `OPEN_ITEMS.md`.
- [ ] Approved commit and requirements are identified.
- [ ] Worktree is clean; unrelated changes are excluded.
- [ ] Migrations, generated types, application code, tests, and documentation agree.

## Database and authorization

- [ ] Clean migration replay passes in a disposable environment.
- [ ] Schema/RLS/grants/RPC assertions pass.
- [ ] System Admin, Host Admin assigned scope, direct routes, and manipulated requests are verified.
- [ ] Audit/history and archive semantics are verified.

## Application and QA

- [ ] Focused unit/service/Storage/authorization tests pass.
- [ ] Relevant Playwright, mobile, keyboard/focus, and manual UAT journeys pass.
- [ ] Broader milestone regression passes when required.
- [ ] Type-check, lint, format-check, production build, and `git diff --check` pass.
- [ ] Secret scan passes; no credentials or generated local artifacts are tracked.

## Legal, Storage, and operations

- [ ] Production legal acknowledgment is approved; otherwise production registration remains blocked.
- [ ] Event-image Storage audit reports no unexplained unreferenced objects.
- [ ] Hosted environment separation and Auth redirect configuration are verified.
- [ ] Backup/PITR capability and restore into a separate environment are confirmed.
- [ ] Monitoring, incident, secret rotation, rollback, and migration forward-fix plans are ready.

## Backup and release

- [ ] Validated commit is backed up to the owner-controlled private remote.
- [ ] Remote commit hash matches local commit.
- [ ] Push/upstream status is recorded.
- [ ] Deployment is performed only with explicit owner authorization and a rollback target.
