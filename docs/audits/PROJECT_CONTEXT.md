# Admin Events — Project Context (Coordinator)

## Project overview

Arakkis is a Next.js + Supabase fitness-event CRM (multi-organization booking and operations). Hosted candidate for this sprint runs on Render with Supabase Auth/Postgres/RLS/Storage.

Stack (current repo): Next.js App Router, TypeScript, React, Tailwind/shadcn-style primitives, Supabase, Vitest, Playwright, ordered SQL migrations.

## Current branch and baseline

| Item | Value |
|---|---|
| Working branch | `fix/integration-and-ux` |
| Deployed / session-fixed SHA | `5ab1907` (`5ab1907d8c4fd335a0b9e58ac0ab7329a5e6ba6f`) |
| Session persistence | **FIXED** — do not modify session cookie / proxy paths listed below |
| Canonical findings | `docs/project/ADMIN_EVENTS_FINDINGS_LEDGER.md` |
| Cycle 1 decisions | `docs/project/ADMIN_EVENTS_PRODUCT_DECISION_CYCLE_1.md` |

## Sprint goals

Implement the approved **Create Event UX & Workflow Hardening** primary slice:

1. Feature-flagged Admin Events V2 UI (all flags default `false`)
2. Terminology, section order, and operator copy (Org/Venue/timezone, capacity per class, recurrence clarity)
3. Remove Affiliation-restricted from Create Event (CE-013); reject tampered server submissions
4. Client-state: recurrence preview, publish confirmation, draft recovery, unsaved-changes warning
5. Validation: Zod event schema surface, ErrorSummary, structured field errors, relative deadline translation

## Critical constraints

### Do not modify (session persistence just fixed)

- `src/proxy.ts`
- `src/lib/db/update-session.ts`
- `src/app/auth/callback/route.ts`
- `src/utils/supabase/server.ts`
- `src/utils/supabase/browser.ts`
- Do **not** create `src/middleware.ts`

### Excluded from this sprint

- No RPC changes (`phase3_create_event_bundle`, `phase3_create_multi_schedule_bundle`)
- No database migrations
- No authorization model changes
- No lifecycle / audit changes
- No image cleanup changes
- No idempotency changes
- No eligibility configuration UI on Create Event (Manage Event only)

### Feature flags (required)

```typescript
// src/lib/features.ts
export const features = {
  adminEventsV2: process.env.NEXT_PUBLIC_FEATURE_ADMIN_EVENTS_V2 === 'true',
  eventRecurrencePreview: process.env.NEXT_PUBLIC_FEATURE_RECURRENCE_PREVIEW === 'true',
  eventPublishConfirmation: process.env.NEXT_PUBLIC_FEATURE_PUBLISH_CONFIRM === 'true',
  eventDraftRecovery: process.env.NEXT_PUBLIC_FEATURE_DRAFT_RECOVERY === 'true',
};
```

All flags default to `false` when env vars are unset.

## File ownership map

### Safe to CREATE

| File | Purpose |
|---|---|
| `src/lib/features.ts` | Feature flags |
| `src/components/admin/PublishConfirmationModal.tsx` | Pre-publish review |
| `src/components/admin/RecurrencePreview.tsx` | Occurrence preview |
| `src/hooks/use-draft-recovery.ts` | Local draft recovery |
| `src/hooks/use-unsaved-changes.ts` | Unsaved-change warning |
| `src/components/admin/ErrorSummary.tsx` | Structured error summary |
| `src/lib/schemas/event.ts` | Client/shared Zod event schema surface |

### Safe to MODIFY (limited)

| File | Allowed change |
|---|---|
| `src/components/admin/event-form-fields.tsx` | Terminology, labels, layout, Venue-change UX |
| `src/components/admin/recurring-schedule-fields.tsx` | Toggle / progressive disclosure |
| `src/app/admin/events/page.tsx` | Integrate new components; CE-013 remove option; section order |
| `src/lib/services/phase-3-actions.ts` | Relative deadline translation; structured errors; reject tampered affiliation-restricted Create |

### Do not touch

Session files listed above; RPC SQL; migrations; Manage Event eligibility redesign beyond leaving Manage Event as the restricted-event configuration surface; public registration authorization semantics.

## Key existing files (reference)

- `src/app/admin/events/page.tsx` — Create Event surface
- `src/app/admin/events/[id]/page.tsx` — Manage Event (eligibility / restricted visibility remains here)
- `src/components/admin/event-form-fields.tsx` — Org/Venue/timing fields
- `src/components/admin/recurring-schedule-fields.tsx` — Series UI
- `src/lib/services/phase-3-actions.ts` — `createEvent` / form actions
- Tests under `tests/` (Vitest + Playwright) for Create Event flows

## Document map

```
docs/
├── audits/
│   ├── ADMIN_EVENTS_UX_AUDIT_1.md      # index → ledger
│   ├── ADMIN_EVENTS_UX_AUDIT_2.md      # index → ledger
│   ├── INTEGRATION_QA_AUDIT.md         # placeholder until full QA audit supplied
│   └── PROJECT_CONTEXT.md              # this file
└── project/
    ├── ADMIN_EVENTS_FINDINGS_LEDGER.md
    └── ADMIN_EVENTS_PRODUCT_DECISION_CYCLE_1.md
```

## Coordinator role

Organize docs → plan phases → delegate Architect / Developer / Tester → report gates. Implementation does not start until Product Owner approves the Phase 1 plan.
