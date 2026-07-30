# Phase 9 — Deployment, Operational Readiness, and Developer Handoff

Status: **Mode A — deployment-ready planning and implementation**. No hosted deployment was
performed in this phase. Starting point is `v1.1-ui-productization-complete` at
`0fd899035d36257f8edc922e5de2a0c7bff0a6e8`.

## Governance

Phase 9 is operational work only. It does not add payments, participant accounts, messaging,
analytics, waitlists, legal documents, new event states, or new registration rules. The existing
migrations `0001`–`0022` are immutable and remain the database source of truth.

Local, preview/staging, and production are separate environments. Preview data is synthetic;
production data is never copied into development. Secrets stay outside Git and deployment
credentials are least-privileged. Git, Vercel, Supabase, registrar, DNS, and future service
accounts must be owned by the user or the user's business. Deployment does not constitute legal
approval; production registration remains blocked until an approved Participation acknowledgment
exists. See `DEC-048`.

## Environment architecture

| Environment | Purpose | Application | Database | Registration |
|---|---|---|---|---|
| Local | development, tests, clean resets | local Next.js | local Supabase/Docker | allowed for synthetic tests |
| Preview/staging | review and smoke tests | Vercel Preview | separate hosted staging project/branch | synthetic only; legal gate active |
| Production | future real administration | Vercel Production | dedicated user-owned project | blocked until legal approval |

## Evidence and completion state

Implemented locally: typed environment validation, safe `.env.example`, reproducible command
surface, security headers, secret scan, and runbooks. Hosted preview, production, custom domain,
hosted Auth, and hosted migration evidence are **awaiting user-owned accounts and authorization**.
The applicable completion tag is therefore `v1.2-deployment-ready`, not the deployed completion tag.

## MVP free-tier deployment audit — 2026-07-30

The requested deployment branch `codex/mvp-free-tier-deployment` was created from the
deployment-ready release without rewriting history. Repository validation completed locally:

- `pnpm install --frozen-lockfile`
- `pnpm format-check`, `pnpm lint`, `pnpm type-check`, `pnpm test` (26 tests), and `pnpm build`
- `pnpm secret-scan`
- clean Supabase replay of migrations `0001` through `0022`
- `bash scripts/validate-database.sh`
- `pnpm test:concurrency`
- `pnpm test:legal` (production-equivalent legal gate)
- `pnpm test:e2e` (46 browser tests)

The local evidence confirms migration replay, schema/runtime assertions, RLS/authorization coverage,
capacity and invitation concurrency behavior, and production-equivalent registration blocking while
the Participation acknowledgment remains provisional. No hosted project, provider URL, Auth
configuration, or real participant data was created by this audit.

Hosted execution is blocked at owner-account authorization: this checkout has no Git remote, GitHub
CLI or Vercel CLI, and the Supabase CLI has no authenticated project-management session. The owner
must authenticate the selected GitHub/Supabase/hosting accounts and provide or authorize the
owner-controlled repository/project connections before remote creation, migration application,
environment-secret configuration, hosted smoke testing, backup export, push, or the final live tag
can be truthfully completed. The legal gate must remain fail-closed until an approved acknowledgment
version is published.

## Requirement synchronization

This document, `docs/26`–`docs/34`, the updated README, and `DEC-048` synchronize the Phase 9
requirements with the build plan, technical design, security design, testing handoff, and acceptance
ledger. No product requirement document was weakened.
