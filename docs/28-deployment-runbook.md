# Deployment runbook

This repository is prepared for Vercel + Supabase but does not create accounts, domains, billing,
projects, or deployments. The user owns the Vercel team/project and separate Supabase staging and
production projects.

## Staging/preview

1. Create a user-owned Supabase staging project and record its project ref securely.
2. Configure Auth site URL and exact preview callback/acceptance URLs.
3. Apply migrations in order with a reviewed Supabase CLI connection; inspect status and logs.
4. Create a user-owned Vercel project, connect Git, select the protected production branch, and set
   preview variables from staging only.
5. Set `APP_ENV=staging`, HTTPS `NEXT_PUBLIC_APP_URL` and `APP_BASE_URL`, public key, and server key.
6. Enable preview protection where the selected plan supports it. Do not rely on an obscure URL.
7. Deploy and run `docs/32` preview smoke checks. Record the URL in an external deployment record,
   not in application code.

## Production

Require preview evidence, user-owned production Supabase/Vercel, correct Auth URLs, verified
environment separation, backup capability review, secure initial System Admin provisioning, a
rollback target, and the legal gate still blocked. Apply migrations after a confirmed backup and
never use `supabase db reset` against production. Production registration is not enabled by deploy.

Vercel uses standard Next.js detection, pnpm lockfile detection, `pnpm build`, and Node 22.22.1. No
custom `vercel.json` is needed. Review logs without exposing environment values. Re-deploy after
environment changes; remove developer access during offboarding.

## Auth and domain

Set each environment's site URL and exact redirect URLs, including invitation acceptance. Use secure
cookies over HTTPS, test session persistence/sign-out, reject invalid redirects, and keep accounts
isolated. A custom domain requires user-approved registrar/DNS changes, Vercel verification, HTTPS,
canonical URL update, Supabase site/redirect update, QR/link review, and a rollback URL.

## Remote migration policy

Migrations `0001`–`0022` are immutable; apply in order, stage before production, inspect schema
differences, and prefer forward-fix migrations. Dashboard edits must be reconciled into a new
migration. Destructive changes require a confirmed backup and compatibility review. Migration output
must be sanitized.
