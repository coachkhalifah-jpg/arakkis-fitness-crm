# Developer handoff and ownership

The owner must control the Git repository/organization, Vercel team/project, Supabase organization
and staging/production projects, domain registrar/DNS, and future monitoring/backup accounts. A
developer receives the minimum collaborator access needed, never sole ownership. Review members,
branch protection, deployment logs, and remove access plus rotate credentials on offboarding.

Branch names use `codex/<phase-or-task>`. Pull requests include requirement IDs, migrations/tests,
security and accessibility review, and documentation updates. Production dashboard edits, secrets in
Git, historical migration edits, and direct unreviewed production changes are prohibited.

Clean-room exercise: fresh checkout → documented Node/pnpm → install → `.env.example` copy → Docker
and Supabase → reset → runtime fixtures → local routes → synthetic admin → unit/browser/type/lint/
build gates → temporary non-functional UI change on a temporary branch → build → revert → clean
working tree. Record failures and corrections in the phase acceptance ledger. Do not commit the
temporary change.
