# Environment variables

Only these variables are consumed by application code or test configuration. Values below are
examples, never credentials.

| Name | Scope | Required | Consumers | Failure behavior |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | all runtimes | browser/server Supabase clients, middleware, tests | typed URL validation fails safely |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | all runtimes | browser/server clients, middleware, tests | missing/empty configuration fails |
| `NEXT_PUBLIC_APP_URL` | public | all runtimes | invitation/canonical URL fallback, QR | URL validation fails; hosted non-HTTPS rejected |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | server/test workflows | privileged client and synthetic test setup | server validation fails; never bundled |
| `APP_BASE_URL` | server-only preference | hosted link generation; optional local/test | invitation, QR, canonical links | falls back to public URL; hosted URL is validated |
| `APP_ENV` | server/test | all runtimes | legal gate and environment separation | unknown values fail; production is fail-closed |
| `LEGAL_READINESS` | server-only | hosted production activation | application legal gate | `PROVISIONAL` blocks production registration; only `APPROVED` permits activation |

`NEXT_PUBLIC_*` values are public, not authorization credentials. The service-role key is never
imported by browser-safe modules. `.env`, `.env.local`, and `.env.*.local` are ignored and must be
created from `.env.example`.

Local uses `http://127.0.0.1:54321` from `supabase status` and `http://127.0.0.1:3000`. Preview and
production use their own HTTPS URL and Supabase project values. Test configuration is created by
Playwright from the local CLI; it must never point at staging or production. There are no legal-gate
environment bypass variables: the database gate uses environment settings and production accepts
only `APPROVED` legal status. The application also requires `LEGAL_READINESS=APPROVED`; these
settings are activation controls, not bypasses.

Rotation: rotate keys in the owning Supabase/Vercel account, update the environment through the
secret manager/dashboard, redeploy, and run smoke tests. Never log full environments, tokens,
passwords, or key values. Missing configuration is an actionable server error without secret output.
