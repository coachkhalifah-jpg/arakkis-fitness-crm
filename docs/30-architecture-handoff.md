# Architecture handoff

Next.js App Router renders public pages and admin pages. Server components and server actions use
the SSR Supabase client with cookie sessions; browser components use only the public client. The
privileged client is marked `server-only` and is reserved for trusted slug resolution, QR/link
operations, and test setup. Middleware refreshes sessions and does not replace server/data-layer
authorization.

The domain is organizations → venues → events → publication/slug → registrations/attendance. A
global participant identity retains affiliation-at-registration and history. CRM/follow-up is
System Admin-only. Host Admin access is constrained by assigned host organizations in server code,
RPCs, RLS, and data access. Audit/history is preserved; cancellation and attendance transitions are
immutable. QR routes resolve canonical URLs using the environment-aware base URL.

The legal gate exists in server actions and the database registration wrapper. In production, only
an approved acknowledgment configuration may permit registration; publication, links, QR, cached
pages, and direct RPC access do not bypass it.

Testing is layered: Vitest component/service tests, Playwright phase suites, SQL assertions, schema
lint, runtime validation, concurrency tests, and production build. Deployment is Vercel with separate
Supabase local/staging/production environments. No secrets or machine paths belong in this document.
