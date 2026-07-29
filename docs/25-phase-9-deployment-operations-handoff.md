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

## Requirement synchronization

This document, `docs/26`–`docs/34`, the updated README, and `DEC-048` synchronize the Phase 9
requirements with the build plan, technical design, security design, testing handoff, and acceptance
ledger. No product requirement document was weakened.
