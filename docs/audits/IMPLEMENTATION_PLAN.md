# Admin Events Implementation Plan (Coordinator)

Status: `AWAITING PRODUCT OWNER APPROVAL` — do not start implementation until approved.

Baseline: `fix/integration-and-ux` @ `5ab1907`  
Canonical inputs: Findings Ledger + Product Decision Cycle 1 + PROJECT_CONTEXT.md

---

## Phase dependency graph

```
Phase 1 Foundation
    ↓
Phase 2 UI Integration ──────────────┐
    ↓                                 │
Phase 3 Client-State ←────────────────┤ (flags from Phase 1)
    ↓                                 │
Phase 4 Validation ←──────────────────┘
    ↓
Quality gates (tsc / lint / build / flags default false)
```

Phases 2–4 may overlap on distinct files after Phase 1 lands, but each quality gate runs before declaring a phase complete.

---

## Phase 1 — Foundation (feature flags + new component shells)

**Depends on:** nothing (docs already committed).  
**Agents:** Architect (review flag API) → Developer → Tester (flag defaults).

### CREATE

| File | Notes |
|---|---|
| `src/lib/features.ts` | Four flags; env `=== 'true'` only; default `false` |
| `src/components/admin/PublishConfirmationModal.tsx` | Shell behind `eventPublishConfirmation` |
| `src/components/admin/RecurrencePreview.tsx` | Shell behind `eventRecurrencePreview` |
| `src/components/admin/ErrorSummary.tsx` | Shell behind `adminEventsV2` |
| `src/hooks/use-draft-recovery.ts` | Hook behind `eventDraftRecovery` |
| `src/hooks/use-unsaved-changes.ts` | Hook; gated by `adminEventsV2` |
| `src/lib/schemas/event.ts` | Schema module skeleton aligned with existing create payload |

### MODIFY

None required beyond importing flags when wiring begins in Phase 2.

### NOT TOUCH

Session persistence files; RPCs; migrations; `phase-3-actions.ts` (until Phase 4).

### Exit criteria

- Flags exist and evaluate `false` without env
- New files compile; no behavior change on Create Event with flags off
- `npx tsc --noEmit` pass

---

## Phase 2 — UI Integration (terminology, layout, CE-013)

**Depends on:** Phase 1 flags.  
**Agents:** Architect (section order vs Product Decision Cycle) → Developer → Tester.

### MODIFY

| File | Work |
|---|---|
| `src/app/admin/events/page.tsx` | Section order toward Offering → Org/Venue → Schedule → Series → Registration → Optional → Review; remove Create Event `AFFILIATION_RESTRICTED` option; Draft-first CTA hierarchy when `adminEventsV2`; integrate shells behind flags |
| `src/components/admin/event-form-fields.tsx` | Org/Venue/Public Venue copy; capacity “per class”; timezone prominence; optional-field labeling |
| `src/components/admin/recurring-schedule-fields.tsx` | Explicit Series opt-in / progressive disclosure; helper text for dates created vs 14-day selection window |

### CREATE

None (use Phase 1 shells).

### NOT TOUCH

`src/app/admin/events/[id]/page.tsx` eligibility/restricted configuration (leave Manage Event as the restricted path); session files; migrations/RPC.

### Exit criteria

- With flags `false`, Create Event UI unchanged (or minimally additive-invisible)
- With `adminEventsV2=true`, CE-013 option absent; terminology/layout updates visible
- No Manage Event regression intended

---

## Phase 3 — Client-State (draft recovery, unsaved changes, previews)

**Depends on:** Phase 1 shells; Phase 2 page integration points.  
**Agents:** Developer → Tester (manual + unit).

### MODIFY / WIRE

| File | Work |
|---|---|
| `src/app/admin/events/page.tsx` | Wire `use-draft-recovery`, `use-unsaved-changes`, `RecurrencePreview`, `PublishConfirmationModal` behind flags |
| `src/components/admin/event-form-fields.tsx` | Venue-change confirmation when timezone meaning would shift |
| `src/components/admin/PublishConfirmationModal.tsx` | Fill summary: name, Org, Venue, TZ, schedule, count, capacity/class, deadline behavior, access |
| `src/components/admin/RecurrencePreview.tsx` | Live first/last/count; weeks/count → end date display |

### NOT TOUCH

Server autosave; RPCs; migrations; session files.

### Exit criteria

- Flags off → no draft recovery / no modal / no preview
- Flags on → preview and publish confirm behave; localStorage draft scoped safely; beforeunload/unsaved warning only when dirty

---

## Phase 4 — Validation (Zod, structured errors, server actions)

**Depends on:** Phases 1–3 for ErrorSummary wiring; can start schema work in parallel after Phase 1.  
**Agents:** Architect (server-action blast radius) → Developer → Tester.

### CREATE / COMPLETE

| File | Work |
|---|---|
| `src/lib/schemas/event.ts` | Shared/client Zod for Create Event fields including deadline presets |
| `src/components/admin/ErrorSummary.tsx` | Field-linked summary + focus management |

### MODIFY (limited)

| File | Allowed only |
|---|---|
| `src/lib/services/phase-3-actions.ts` | (1) Translate relative/preset deadline → existing `registrationDeadlineLocal`; (2) structured field error responses; (3) reject tampered `AFFILIATION_RESTRICTED` on Create |
| `src/app/admin/events/page.tsx` | Render `ErrorSummary` from structured errors when `adminEventsV2` |

### NOT TOUCH

RPC definitions; migrations; authorization helpers beyond rejecting unsupported Create visibility; image cleanup; idempotency keys; session files.

### Exit criteria

- Tampered affiliation-restricted Create rejected server-side
- Deadline presets produce correct local deadline strings for existing pipeline
- Structured errors surface in ErrorSummary when flag on
- Full quality gates green

---

## Agent assignments

| Role | Responsibility |
|---|---|
| **Architect** | Review plan vs ledger boundaries; confirm no session/RPC/migration conflict; approve Phase 4 action diff shape |
| **Developer** | Implement Phases 1→4 in order; keep all new UX behind flags |
| **Tester** | Unit/component tests for flags, CE-013 absence, deadline translation, ErrorSummary; smoke Create Event with flags off (regression) and on |
| **Coordinator** | Gate each phase report; block out-of-scope drift; no code authored by Coordinator |

---

## Quality gates (every phase)

| Gate | Command / check |
|---|---|
| Typecheck | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Build | `npm run build` |
| Feature flags | All four default `false` without env |
| Session freeze | Diff must not include proxy/session/auth callback/supabase client files or new `middleware.ts` |
| Scope freeze | Diff must not include migrations or RPC SQL |

---

## Reporting template (after each phase)

```
[Phase X] Complete
Files Created: [list]
Files Modified: [list]
Tests Passed: [yes/no]
Typecheck: [pass/fail]
Build: [pass/fail]
Blockers: [none / description]
Next: [what's next]
```

---

## Explicit non-goals this sprint

- Copy Event (CE-012)
- Same-Venue overlap warnings (CE-015)
- Recurring image multiplication copy (CE-014)
- Back-to-back class modeling (CE-010)
- Eligibility configuration on Create Event
- Any change to session persistence

---

**Coordinator asks Product Owner:** approve this plan to proceed with Phase 1 (Foundation only), or request revisions.
