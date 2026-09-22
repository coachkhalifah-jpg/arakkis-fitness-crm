# Admin Events Product Decision Cycle 1

Status: `APPROVED` for the bounded primary Create Event UX & Workflow Hardening package.  
Source of truth for findings: [`ADMIN_EVENTS_FINDINGS_LEDGER.md`](ADMIN_EVENTS_FINDINGS_LEDGER.md).  
Working branch for this sprint: `fix/integration-and-ux` @ `5ab1907`.

## Scope boundary (approved)

`UI ONLY + CLIENT STATE + VALIDATION`, with limited Server Action adjustments only for:

- Relative/preset registration-deadline translation to existing `registrationDeadlineLocal`
- Structured field-linked error responses
- Rejecting tampered `AFFILIATION_RESTRICTED` Create Event submissions

**Out of scope:** RPC changes, database migrations, authorization model changes, Event lifecycle/audit changes, image cleanup changes, idempotency redesign, eligibility configuration UI on Create Event.

## Recommended pre-pilot package

| Finding | Classification | Slice treatment |
|---|---|---|
| CE-001 Capacity/registration sequence | STRONG PRE-PILOT; UI ONLY | Reorder sections; place capacity with registration decision |
| CE-002 Org / Venue / Public Venue model | STRONG PRE-PILOT; UI ONLY | Explicit operator copy; clear invalid Venue on Org change |
| CE-003 Venue change timezone meaning | PRE-PILOT REQUIRED; CLIENT STATE + VALIDATION | Warn/confirm; revalidate; do not make timezone editable |
| CE-004 Relative registration deadline | STRONG PRE-PILOT; CLIENT STATE + VALIDATION | Preset/relative UI translating to existing local deadline |
| CE-005 Capacity per class semantics | STRONG PRE-PILOT; UI ONLY + VALIDATION | Label “per class/occurrence”; surface default consequence |
| CE-006 Visibility/access consequences | PRE-PILOT REQUIRED; VALIDATION + SERVER ACTION | Consequence matrix; prevent contradictory combinations |
| CE-007 Recurrence weeks/count translation | PRE-PILOT REQUIRED; CLIENT STATE + VALIDATION | Translate weeks/count → end date; live generated count |
| CE-008 Dates created vs selection window | STRONG PRE-PILOT; UI ONLY | Separate “dates created” from “open for selection” |
| CE-011 Publish operational review | PRE-PILOT REQUIRED; CLIENT STATE + UI ONLY | Pre-publish confirmation summary |
| CE-013 Affiliation-restricted option | PILOT OPERATIONAL BLOCKER | **Remove option from Create Event**; reject tampered submits |

### Deferred (do not implement in this sprint)

- CE-009 Optional content finish-later clarity — POST-PILOT
- CE-010 Back-to-back classes explanation — DEFERRED
- CE-012 Copy Event — DEFERRED / POST-PILOT
- CE-014 Recurring image multiplication copy — DEFERRED
- CE-015 Same-Venue overlap / cross-midnight — DEFERRED

## Product decisions required

Cycle 1 Product Owner decisions are resolved for the primary slice. Retained as decision history:

1. Capacity default `20` — keep with explicit “per class” labeling and review visibility (approved for pilot).
2. Registration deadline — relative/preset model with optional custom absolute; translate to existing stored local deadline.
3. Visibility + Access — keep two-axis model at creation with consequence labeling; remove Affiliation-restricted from Create Event.
4. Recurrence primary input — weeks/count translation to existing end-date backend; show resolved end date and count.
5. Pre-submit review — required for Publish; Draft may share summary with lower-risk CTA.
6. Optional participant content — remain optional at creation; do not silently require for publish.
7. Copy Event — post-pilot.
8. Affiliation-restricted without eligibility — **remove/disable on Create Event**; configure later in Manage Event.
9. Same-Venue overlap / cross-midnight — deferred; no overnight Events.
10. Recurring image multiplication — deferred explanation-only post-pilot.

## Proposed target Create Event workflow

Operator sequence:

1. **Offering** — Event name
2. **Organization / Venue** — host Organization; Venue (Organization Venues vs Public Venues explained); system-derived timezone
3. **Schedule** — date, start/end, duration helpers; Venue-change timezone confirmation
4. **Series** — explicit opt-in progressive disclosure; weeks/count → end date; schedule rows; live occurrence preview (first/last/count; dates created vs 14-day selection window)
5. **Registration** — capacity per class; deadline presets/relative (+ custom); access consequences (Public visibility only on Create; no Affiliation-restricted)
6. **Participant information** — optional description / instructions (clearly optional)
7. **Presentation** — optional image / communication link
8. **Publish review** — summary of consequential values; Draft-first CTA hierarchy; Publish confirmation modal

## CE-013 decision (binding)

Remove the Affiliation-restricted option entirely from **Create Event**. Do not replace it with eligibility configuration on Create. Admins who need restricted Events configure them in **Manage Event**. Server Action must reject tampered `AFFILIATION_RESTRICTED` Create submissions.

## Recommended implementation order

1. **Foundation** — feature flags (`src/lib/features.ts`); new presentational shells behind flags defaulting `false`
2. **UI Integration** — terminology, section order, CE-013 removal, recurrence toggle progressive disclosure, labels/helper text
3. **Client-State** — draft recovery hook, unsaved-changes warning, Venue-change confirmation, recurrence preview, publish confirmation modal
4. **Validation** — Zod event schema surface, structured errors, ErrorSummary, deadline translation, tampered restricted-visibility rejection

All new UI ships behind:

```typescript
export const features = {
  adminEventsV2: process.env.NEXT_PUBLIC_FEATURE_ADMIN_EVENTS_V2 === 'true',
  eventRecurrencePreview: process.env.NEXT_PUBLIC_FEATURE_RECURRENCE_PREVIEW === 'true',
  eventPublishConfirmation: process.env.NEXT_PUBLIC_FEATURE_PUBLISH_CONFIRM === 'true',
  eventDraftRecovery: process.env.NEXT_PUBLIC_FEATURE_DRAFT_RECOVERY === 'true',
};
```

## Session-persistence freeze (do not modify)

- `src/proxy.ts`
- `src/lib/db/update-session.ts`
- `src/app/auth/callback/route.ts`
- `src/utils/supabase/server.ts`
- `src/utils/supabase/browser.ts`
- Do **not** create `src/middleware.ts`

## Quality gates

- `npx tsc --noEmit` passes
- `npm run lint` passes
- `npm run build` succeeds
- Feature flags default to `false`
- No migrations / RPC / authorization model changes

## Control board (Cycle 1)

| Package | Product | Engineering | Independent QA | Integration |
|---|---|---|---|---|
| Create Event UX & Workflow Hardening | APPROVED | READY FOR IMPLEMENTATION on `fix/integration-and-ux` @ `5ab1907` | NOT STARTED | NOT READY until flags validated |

Baseline for this sprint: deployed SHA `5ab1907` on `fix/integration-and-ux` (session persistence fixed; do not regress).
