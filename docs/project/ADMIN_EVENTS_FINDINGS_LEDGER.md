# Admin Events findings ledger

Canonical ledger for Admin Events discovery, UAT, audits, and approved change control.

## Ledger rules

- `PROPOSED` and `PRODUCT REVIEW` findings are not implementation authorization.
- Engineering receives only findings explicitly moved to `APPROVED` by the Product Owner.
- Audit 1 findings are deduplicated here by reference where Audit 2 reaches the same boundary.
- `PRE-PILOT REQUIRED` is reserved for material operator-error, task-completion, recoverability, accessibility, data-integrity, or publish-confidence risk.
- Migration status is conservative because the current RC2 candidate documents migration head `0069`, while this local dirty checkout contains files through `0066`.

## Existing validated Admin Events baseline — Cancelled Event Archive

Status: `EXISTING VALIDATED BASELINE — PRESERVE`.

The RC2 Cancelled-Event archive capability was implemented and independently QA verified. It is not an Admin Events discovery defect and must not be redesigned as part of the current initiative.

- An authorized System Admin may archive a cancelled Event.
- Archival leaves the Event in `CANCELLED` status.
- Archived Events are excluded from the default Admin Events working view.
- Archived Events remain available in the archived Events view and through historical detail access.
- Registrations, attendance, legal evidence, notifications, Series relationships, and audit history are preserved.
- Event deletion is not destructive and does not exist as an alternative workflow.
- No restore behavior currently exists.

Admin Events may evaluate presentation only: Archive placement on card versus detail, confirmation copy, archived-section organization, discoverability, and cancelled/archived visual treatment. Any recommendation that changes archive semantics, introduces deletion, or adds restore requires an explicit Product Owner decision and architecture review. Future findings must record RC2 impact against this preserved baseline.

## Continuous orchestration protocol

After Product Owner approval, each implementation package is driven through:

`APPROVED` → `ENGINEERING ASSIGNED` → `ENGINEERING ACTIVE` → `ENGINEERING VALIDATED` → `INDEPENDENT QA` → `QA FAILED / QA VERIFIED` → `CORRECTION` when required → `RETEST` → `QA VERIFIED` → `INTEGRATION READY`.

Whenever a workstream returns, the Coordinator inspects its result, reconciles repository/branch/base-SHA/HEAD/worktree/migration/environment evidence, checks acceptance criteria, identifies missing evidence or defects, and issues the next appropriate instruction. Routine sequencing is not delegated to the Product Owner.

The Coordinator cannot assume automatic wake-up on another task’s completion. Every orchestration cycle ends with a `NEXT COORDINATOR TRIGGER` naming the event that should cause the next cycle. If a workstream silently completes or omits required evidence twice, it is classified `STALLED — REASSIGNMENT REQUIRED`; reassignment is attempted, and an exact replacement prompt is supplied if automatic reassignment is unavailable.

## Audit 2 intake

Audit 1 source: task `01a0549e-64f8-7583-9c3b-89973392b0d4`, titled `Arakkis — Create Event UX & Workflow Audit`, supplied in attachment `c21903d9-20a7-404b-b6cf-b312d578202e`.

Audit 2 source: task `01a054da-232f-70c3-8f1d-75f915a75ee0`, titled `Arakkis — Create Event Operator Workflow & Error-Proofing Audit`, supplied in attachment `15fa10b6-1aad-4e1c-a94c-0002d780bd70`.

Repository: `/Users/abdulalhaj/Documents/Arakkis`  
Branch: `codex/rc3-password-reset`  
HEAD observed: `ae3c9b749c106aa712197805b8c49a7385f77559`  
Working tree: `DIRTY`; existing RC2/password-recovery and cancelled-Event archive changes were not modified.  
Environment: `LOCAL / READ-ONLY`; no hosted data or browser-rendered inspection was used for this intake.  
Migration evidence: local files through `0066`; RC2 candidate documentation records hosted/candidate head `0069`.  
Audit disposition: ingested below; no code, migration, test, configuration, or fixture changes were made.

## Current known Audit 1 overlap

These topics were already recorded by the coordinator initialization and are not duplicated as new Audit 2 findings: error communication/recovery, form-state loss, image failure recovery, Draft/Publish hierarchy, recurrence progressive disclosure, occurrence preview, unsaved changes, accessibility/error focus, and uncertain post-commit state. Audit 2 references them only where an operational dependency changes their acceptance criteria.

The thread check confirms that Audit 1 and Audit 2 are complementary, not duplicate audits. Audit 1 prioritizes resilience and interaction architecture; Audit 2 prioritizes operator decisions, dependencies, defaults, consequences, and error prevention.

## Findings

### CE-001 — Creation sequence places capacity before the operational registration decision

- Source: Audit 2, current Create Event implementation.
- Current behavior: Event basics contains Name, Organization, Venue, and required Capacity; registration controls are not a separate section. Schedule follows, then Series, Visibility/access, participant information, communications, and image.
- Desired outcome: Product should decide whether the operator sequence is Offering → Organization/Venue → Schedule → Series → Registration → Participant information → Presentation → Publish review. Capacity should be explained where the operator decides registration capacity, while retaining a concise basics summary.
- Operator impact: Capacity is entered before the operator has seen the registration/access consequence and its recurring meaning.
- Severity: MEDIUM.
- Evidence: `src/app/admin/events/page.tsx`; `eventSchema.capacity` is required and the UI defaults it to `20`.
- Product value: MEDIUM.
- Complexity estimate: MEDIUM.
- Likely affected files/boundaries: Create Event page and reusable form sections; no domain-model change implied.
- Backend impact: None if presentation-only.
- Migration requirement: None expected.
- RC2 conflict: LOW EXPECTED CONFLICT; Admin Events next-release UX only.
- Product status: APPROVED (Cycle 1).
- Engineering status: NOT ASSIGNED.
- QA status: NOT APPLICABLE until approved.
- Target release: PRE-PILOT REVIEW / next release; not RC2.
- Recommendation classification: STRONG PRE-PILOT IMPROVEMENT; UI ONLY; MEDIUM; SAFE PARALLEL.

### CE-002 — Organization, Organization Venue, and Public Venue need an explicit operator model

- Source: Audit 2.
- Current behavior: Organization is required; Venue options are grouped as `Organization Venues — <name>` and `Public Venues`. Server validation permits a Venue owned by the selected Organization or an independent Venue with `organization_id = null`.
- Desired outcome: Explain that Organization identifies the host/owner of the Event, while Venue identifies where it occurs; a Public Venue is a reusable location not owned by that Organization. Changing Organization should clear an invalid Venue and require a fresh choice.
- Operator impact: The UI is technically scoped but a Public Venue can be read as belonging to the selected Organization, creating publishing and operational ambiguity.
- Severity: MEDIUM.
- Evidence: `src/components/admin/event-form-fields.tsx`; `createEvent` venue relationship validation in `src/lib/services/phase-3-actions.ts`.
- Product value: HIGH.
- Complexity estimate: SMALL.
- Likely affected files/boundaries: `event-form-fields.tsx`, Create Event helper text, focused component/UAT tests.
- Backend impact: Preserve existing authorization and relationship checks.
- Migration requirement: None.
- RC2 conflict: LOW EXPECTED CONFLICT.
- Product status: APPROVED (Cycle 1).
- Engineering status: NOT ASSIGNED.
- QA status: NOT APPLICABLE until approved.
- Target release: PRE-PILOT REVIEW; not RC2.
- Recommendation classification: STRONG PRE-PILOT IMPROVEMENT; UI ONLY; SMALL; SAFE PARALLEL.

### CE-003 — Venue changes silently change the meaning of entered local times

- Source: Audit 2.
- Current behavior: Venue timezone is system-derived and displayed after Venue selection. Local date/time and deadline controls retain their entered clock values when Venue changes; the server converts those same local strings using the newly selected Venue timezone. Recurrence generation also uses the new timezone.
- Desired outcome: Keep local clock values by default, but explicitly warn/confirm that the UTC instant, DST interpretation, recurrence occurrences, and deadline instants will be recalculated in the new Venue timezone. Revalidate before submission; do not make timezone editable or weaken DST validation.
- Operator impact: A Venue change can move the actual Event instant without an obvious state change.
- Severity: HIGH.
- Evidence: `EventTimingFields` listens for Venue changes only to update displayed timezone; `createEvent` calls `parseEventTimes` and recurrence builders with the selected Venue timezone.
- Product value: HIGH.
- Complexity estimate: MEDIUM.
- Likely affected files/boundaries: `event-form-fields.tsx`, recurrence client state, validation messaging, focused UAT tests.
- Backend impact: Preserve authoritative Venue-local interpretation, UTC persistence, and DST validation.
- Migration requirement: None expected.
- RC2 conflict: LOW EXPECTED CONFLICT; no shared authorization change.
- Product status: APPROVED (Cycle 1).
- Engineering status: NOT ASSIGNED.
- QA status: NOT APPLICABLE until approved.
- Target release: PRE-PILOT REVIEW; not RC2.
- Recommendation classification: PRE-PILOT REQUIRED; CLIENT STATE + VALIDATION; MEDIUM; SAFE PARALLEL.

### CE-004 — Registration deadline is absolute in the UI but relative in recurring behavior

- Source: Audit 2.
- Current behavior: A required `datetime-local` deadline defaults to the first Event start. For multi-schedule recurrence, the backend derives each occurrence deadline by preserving the template’s local offset from the template start. The operator is told only that registration closes at or before start.
- Desired outcome: Product should choose a pilot-safe operator model. Recommended direction is an explicit preset/relative choice (`At class start`, `30 minutes before`, `1 hour before`, `2 hours before`) with an optional absolute/custom mode where needed; show the resolved first/last or per-schedule deadlines before publish. Preserve the stored per-occurrence deadline model.
- Operator impact: A single absolute-looking field does not reveal how deadlines behave across schedules and occurrences.
- Severity: HIGH.
- Evidence: `EventTimingFields`; `parseEventTimes`; `buildMultiScheduleOccurrences`; migration `0057_multi_schedule_event_creation.sql`.
- Product value: HIGH.
- Complexity estimate: MEDIUM.
- Likely affected files/boundaries: timing fields, event validation/action payload translation, occurrence summary tests; no RPC redesign required for the recommended UI translation.
- Backend impact: Existing deadline validation and per-occurrence persistence must remain authoritative.
- Migration requirement: None expected for preset/relative translation; schema impact requires separate decision.
- RC2 conflict: LOW EXPECTED CONFLICT.
- Product status: APPROVED (Cycle 1).
- Engineering status: NOT ASSIGNED.
- QA status: NOT APPLICABLE until approved.
- Target release: PRE-PILOT REVIEW; not RC2.
- Recommendation classification: STRONG PRE-PILOT IMPROVEMENT; CLIENT STATE + VALIDATION; MEDIUM; SAFE PARALLEL.

### CE-005 — Capacity default and recurring capacity semantics are not explicit

- Source: Audit 2.
- Current behavior: Capacity is required, defaults to `20`, must be a positive integer up to `100000`, and is copied to every generated occurrence in a series. Zero is rejected. Later Event editing updates an Event’s capacity, not a series-wide capacity contract.
- Desired outcome: Product should state `Capacity per class/occurrence` and decide whether `20` is an approved safe default or must be an explicit choice. The pilot should not imply unlimited capacity and should show the recurring consequence. Changes after registrations must retain existing capacity protections.
- Operator impact: A repeat operator may assume capacity is series-level or may publish an unsafe default without noticing.
- Severity: MEDIUM.
- Evidence: `eventSchema.capacity`; `createEvent` recurrence defaults; migration `0057_multi_schedule_event_creation.sql`.
- Product value: HIGH.
- Complexity estimate: SMALL.
- Likely affected files/boundaries: Create Event copy/placement, card/review summary, focused tests.
- Backend impact: Preserve positive-capacity and registration-capacity enforcement.
- Migration requirement: None expected.
- RC2 conflict: LOW EXPECTED CONFLICT.
- Product status: APPROVED (Cycle 1).
- Engineering status: NOT ASSIGNED.
- QA status: NOT APPLICABLE until approved.
- Target release: PRE-PILOT REVIEW; not RC2.
- Recommendation classification: STRONG PRE-PILOT IMPROVEMENT; UI ONLY + VALIDATION; SMALL; SAFE PARALLEL.

### CE-006 — Visibility and access mode expose combinations whose consequences are not predictable enough

- Source: Audit 2.
- Current behavior: Visibility offers `Public` or `Affiliation restricted`; access mode offers `Public`, `Unlisted`, or `Invite-only`. The form explains the concepts but does not present a consequence matrix. Recurring Invite-only is rejected by the server; other combinations are accepted by the current schema.
- Desired outcome: Product should define and label who can discover and who can register. At minimum, show the consequence for each combination, prevent contradictory combinations, and explain any valid but non-obvious combination. Product must decide whether both controls are needed at creation.
- Operator impact: An operator can select a technically valid combination without understanding listing, link, affiliation, or invitation behavior.
- Severity: HIGH.
- Evidence: Create Event access section; `eventSchema`; recurring Invite-only guard in `createEvent`; publication/access behavior in phase 7 services.
- Product value: HIGH.
- Complexity estimate: MEDIUM.
- Likely affected files/boundaries: Create Event access section, server validation, public discovery/registration tests.
- Backend impact: Potential server validation change; authorization and public registration rules remain authoritative.
- Migration requirement: None expected unless Product changes the domain enum/model.
- RC2 conflict: LOW EXPECTED CONFLICT; public registration boundary requires coordination if semantics change.
- Product status: APPROVED (Cycle 1).
- Engineering status: NOT ASSIGNED.
- QA status: NOT APPLICABLE until approved.
- Target release: PRE-PILOT REVIEW; not RC2.
- Recommendation classification: PRE-PILOT REQUIRED; VALIDATION + SERVER ACTION; MEDIUM; WAIT FOR CORE RC2 only if shared public semantics are changed.

### CE-007 — Recurrence uses an end-date model without translating common fitness-programming goals

- Source: Audit 2.
- Current behavior: Recurrence is weekly only, requires a series end date, and accepts up to 14 schedule rows and 104 total generated dates. The first schedule row is seeded from the one-time Event timing; additional rows copy that row. The backend stores schedule rules and `ends_on`.
- Desired outcome: Keep the current storage and generation model, but let the UI express weeks or total classes as a translation to an end date where unambiguous, and show generated count, first/last dates, and each schedule before creation. Product must decide whether end date, weeks, occurrence count, or a bounded combination is the primary operator input.
- Operator impact: “12 weeks” or “24 classes” requires date calculation and the cost of an unintended 104-date creation is not visible before submit.
- Severity: HIGH.
- Evidence: `recurrenceSchema`, `multiScheduleSchema`, `RecurringScheduleFields`, `buildMultiScheduleOccurrences`, migration `0057_multi_schedule_event_creation.sql`.
- Product value: HIGH.
- Complexity estimate: MEDIUM.
- Likely affected files/boundaries: recurrence UI/state, occurrence preview, validation, focused E2E/component tests; preserve RPC and generation logic.
- Backend impact: Prefer no backend change; any new count contract must reconcile with existing occurrence limit and idempotent RPC.
- Migration requirement: None expected for UI translation/preview.
- RC2 conflict: LOW EXPECTED CONFLICT.
- Product status: APPROVED (Cycle 1).
- Engineering status: NOT ASSIGNED.
- QA status: NOT APPLICABLE until approved.
- Target release: PRE-PILOT REVIEW; not RC2.
- Recommendation classification: PRE-PILOT REQUIRED; CLIENT STATE + VALIDATION; MEDIUM; SAFE PARALLEL.

### CE-008 — Recurrence date/window language can confuse series generation with participant selection

- Source: Audit 2; overlaps Audit 1 occurrence-preview topic but adds an operational consequence.
- Current behavior: Create Event guidance says dates are created through the end date and that participants can select dates only within the next 14 days from the series link. The series itself may contain up to 104 dates.
- Desired outcome: Separate “dates Arakkis will create” from “dates currently open for participant selection,” and show both in the review/summary. Do not change the 14-day selection-window rule without a Product decision.
- Operator impact: Operators may believe only 14 dates are created or that later dates are unavailable, undermining confidence in a recurring launch.
- Severity: MEDIUM.
- Evidence: Create Event recurrence helper text; migration `0057_multi_schedule_event_creation.sql` sets `selection_window_days = 14`.
- Product value: HIGH.
- Complexity estimate: SMALL.
- Likely affected files/boundaries: recurrence helper text and preview; public selection copy only if separately approved.
- Backend impact: None for clarification.
- Migration requirement: None.
- RC2 conflict: LOW EXPECTED CONFLICT; public selection change would be shared-boundary coordination.
- Product status: APPROVED (Cycle 1).
- Engineering status: NOT ASSIGNED.
- QA status: NOT APPLICABLE until approved.
- Target release: PRE-PILOT REVIEW; not RC2.
- Recommendation classification: STRONG PRE-PILOT IMPROVEMENT; UI ONLY; SMALL; SAFE PARALLEL.

### CE-009 — Optional participant and communication content is requested in the creation flow without a clear “finish later” consequence

- Source: Audit 2.
- Current behavior: Description, participant instructions, communication URL/label, and image are optional fields in Create Event. A URL without a label receives the server default `Join the group`; a URL must be HTTPS. There is no explicit indication which omissions are safe to complete after creation.
- Desired outcome: Mark optional content as optional, show where it appears, and let Product decide whether communications, detailed instructions, and image remain creation-time inputs or are clearly deferred to Manage Event. Do not make optional content silently required for publishing.
- Operator impact: Operators may delay a needed launch while searching for information, or publish without realizing participant-facing content is absent.
- Severity: MEDIUM.
- Evidence: Create Event sections; `parseCommunicationLink`; Event detail management surface.
- Product value: MEDIUM.
- Complexity estimate: SMALL.
- Likely affected files/boundaries: Create Event copy/section summaries and Manage Event links.
- Backend impact: Preserve HTTPS and image validation/cleanup behavior.
- Migration requirement: None expected.
- RC2 conflict: LOW EXPECTED CONFLICT.
- Product status: APPROVED (Cycle 1).
- Engineering status: NOT ASSIGNED.
- QA status: NOT APPLICABLE until approved.
- Target release: POST-PILOT unless Product identifies participant confusion as pilot-critical.
- Recommendation classification: POST-PILOT; UI ONLY; SMALL; SAFE PARALLEL.

### CE-010 — Back-to-back classes require separate Events, which is not explained at creation

- Source: Audit 2.
- Current behavior: A standalone Event has one start/end pair. A recurring series can contain multiple weekday/time rules, but same-day overlapping rules are rejected and adjacent non-overlapping rules are represented as separate schedule rows only if they recur on the same weekday. The form does not explain when to create two Events versus one series.
- Desired outcome: Explain that independently bookable back-to-back classes are separate Event occurrences/Events when they need separate capacity, registration, or participant experience. Do not broaden the Series model without Product approval.
- Operator impact: Operators may model two classes as one Event or expect a single Event to provide two independently bookable times.
- Severity: MEDIUM.
- Evidence: one-time timing fields; `multiScheduleSchema` overlap/duplicate checks; per-occurrence capacity and registration model.
- Product value: MEDIUM.
- Complexity estimate: SMALL.
- Likely affected files/boundaries: helper text and possibly Copy Event/product workflow documentation.
- Backend impact: None for clarification.
- Migration requirement: None.
- RC2 conflict: LOW EXPECTED CONFLICT.
- Product status: DEFERRED (Cycle 1).
- Engineering status: NOT ASSIGNED.
- QA status: NOT APPLICABLE until approved.
- Target release: POST-PILOT.
- Recommendation classification: POST-PILOT; UI ONLY; SMALL; SAFE PARALLEL.

### CE-011 — Publish lacks a creation-time operational review of consequential values

- Source: Audit 2; overlaps Audit 1 Draft/Publish hierarchy and occurrence-preview topics.
- Current behavior: Create Event presents `Create Draft` and `Publish Event` buttons at the end. Success reports created status and, for recurrence, count of weekly dates, but there is no pre-submit summary of Venue, timezone, schedule rules, deadline calculation, capacity per occurrence, access consequence, or first/last occurrence.
- Desired outcome: Before Publish, show a review summary sufficient to answer what will be created: name, Organization, Venue, timezone, first/last dates, schedule rules, occurrence count, duration, capacity per class, deadline behavior, visibility, access, and participant-facing content presence. Draft may use the same summary with a lower-risk CTA.
- Operator impact: Accidental recurrence, wrong timezone, unsafe capacity, and unintended access mode can become committed/published state without a final confidence checkpoint.
- Severity: HIGH.
- Evidence: Create Event action buttons and success state in `action-form.tsx`; recurrence count exists only in client validation/server success.
- Product value: HIGH.
- Complexity estimate: MEDIUM.
- Likely affected files/boundaries: Create Event client state, summary component, publish action UI, focused UAT/E2E tests.
- Backend impact: No change required if summary reflects authoritative submitted values.
- Migration requirement: None.
- RC2 conflict: LOW EXPECTED CONFLICT.
- Product status: APPROVED (Cycle 1).
- Engineering status: NOT ASSIGNED.
- QA status: NOT APPLICABLE until approved.
- Target release: PRE-PILOT REVIEW; not RC2.
- Recommendation classification: PRE-PILOT REQUIRED; CLIENT STATE + UI ONLY; MEDIUM; SAFE PARALLEL.

### CE-012 — Repeat-operator efficiency lacks a safe reuse path

- Source: Audit 2.
- Current behavior: Create Event starts with a fresh form; Capacity defaults to 20 and recurrence defaults to weekly in disabled controls, but there is no approved Copy Event or reusable configuration path in the inspected Create Event flow.
- Desired outcome: Product should compare a controlled Copy Event action against increasingly complex remembered defaults. Prefer an explicit copy/review workflow that copies configuration into a new draft while requiring review of Venue, dates, deadline, access, and recurrence before publish. Do not introduce speculative personalization.
- Operator impact: The 30th Event repeats manual entry and increases transcription risk, while unsafe remembered values would persist unnoticed.
- Severity: MEDIUM.
- Evidence: Create Event route/form has no copy input; default values are hard-coded in `page.tsx`.
- Product value: MEDIUM.
- Complexity estimate: LARGE.
- Likely affected files/boundaries: Events list/detail actions, Create Event initialization, server action/idempotency, E2E/authorization tests.
- Backend impact: Potential server action and authorization work; must preserve scope and audit.
- Migration requirement: None expected for a copy action; schema changes not justified by Audit 2.
- RC2 conflict: LOW EXPECTED CONFLICT; larger than a safe RC2-adjacent change.
- Product status: DEFERRED (Cycle 1).
- Engineering status: NOT ASSIGNED.
- QA status: NOT APPLICABLE until approved.
- Target release: POST-PILOT.
- Recommendation classification: POST-PILOT; CROSS-LAYER; LARGE; SAFE PARALLEL after Product decision.

### CE-013 — Affiliation-restricted Events have no visible eligibility configuration

- Source: Audit 2, reconciled against Audit 1.
- Current behavior: Create Event permits `AFFILIATION_RESTRICTED` visibility, but the form has no eligible-Organization selector. The Event can therefore be created or published without a visible way to define who qualifies.
- Desired outcome: Prevent Publish until eligible Organizations are configured, or remove this choice from Create Event until the configuration workflow exists. Product must decide whether a restricted Draft may exist incomplete.
- Operator impact: An Event may be publicly presented but unavailable to every participant.
- Severity: HIGH.
- Evidence: Create Event visibility select; no eligibility control in `src/app/admin/events/page.tsx`; `eventSchema` accepts the restricted enum.
- Product value: HIGH.
- Complexity estimate: MEDIUM.
- Likely affected files/boundaries: Create Event, Event/eligibility server action or existing configuration surface, public registration authorization, tests.
- Backend impact: Cross-layer/public registration authorization coordination required.
- Migration requirement: UNKNOWN; reservation pending if schema/RPC changes are required.
- RC2 conflict: CONFLICTS WITH ACTIVE RC2 if public eligibility semantics or migration are changed; do not modify RC2.
- Product status: APPROVED (Cycle 1; remove/disable unsupported choice only).
- Engineering status: NOT ASSIGNED.
- QA status: NOT APPLICABLE until approved.
- Target release: PRE-PILOT decision; not RC2.
- Recommendation classification: PILOT OPERATIONAL BLOCKER; CROSS-LAYER; MEDIUM; WAIT FOR CORE RC2.

### CE-014 — Recurring image multiplication is invisible during creation

- Source: Audit 2.
- Current behavior: A recurring upload is staged once per generated occurrence and attached to each materialized Event. The operator sees only one Event image input.
- Desired outcome: Explain that the image is copied to every occurrence and preserve the existing cleanup/replacement guarantees. Product should decide whether image remains optional for Draft and whether it is required before Publish.
- Operator impact: Unexpected storage/presentation behavior and repeated future image maintenance.
- Severity: LOW.
- Evidence: `uploadScheduleEventImage` in `src/lib/services/phase-3-actions.ts`; recurring asset rows in migration `0057_multi_schedule_event_creation.sql`.
- Product value: MEDIUM.
- Complexity estimate: SMALL.
- Likely affected files/boundaries: Create Event helper text, focused UAT copy check.
- Backend impact: Preserve existing image lifecycle.
- Migration requirement: None expected.
- RC2 conflict: LOW EXPECTED CONFLICT.
- Product status: DEFERRED (Cycle 1).
- Engineering status: NOT ASSIGNED.
- QA status: NOT APPLICABLE until approved.
- Target release: POST-PILOT.
- Recommendation classification: POST-PILOT; UI ONLY; SMALL; SAFE PARALLEL.

### CE-015 — Same-Venue overlap and cross-midnight behavior are undefined operator decisions

- Source: Audit 2.
- Current behavior: Schedule-row overlap is rejected within a recurring series, but the inspected Create Event flow does not surface overlap warnings against other Events at the same Venue. A local end time earlier than start is rejected, so overnight Events are unsupported.
- Desired outcome: Warn on same-Venue conflicts without blocking until Product decides whether setup/turnover overlap is legitimate. Product must explicitly confirm whether cross-midnight Events are out of scope.
- Operator impact: Possible double-booking or unexplained inability to model overnight programming.
- Severity: MEDIUM.
- Evidence: `multiScheduleSchema` overlap checks and `parseEventTimes` ordering validation; no Create Event Venue conflict lookup.
- Product value: MEDIUM.
- Complexity estimate: MEDIUM.
- Likely affected files/boundaries: Create Event validation/server action, Venue schedule query, product tests.
- Backend impact: Potential read/query and validation behavior; no migration assumed.
- Migration requirement: None expected.
- RC2 conflict: LOW EXPECTED CONFLICT; do not change shared scheduling semantics without approval.
- Product status: DEFERRED (Cycle 1).
- Engineering status: NOT ASSIGNED.
- QA status: NOT APPLICABLE until approved.
- Target release: POST-PILOT unless Product elevates it.
- Recommendation classification: POST-PILOT; VALIDATION + SERVER ACTION; MEDIUM; WAIT FOR PRODUCT DECISION.

## Field classification and Product review summary

| Field/concept | Audit 2 classification | Current downstream consequence | Safe default / Product question |
|---|---|---|---|
| Event name | REQUIRED AT CREATION | Public/admin identity and slug basis | Require explicit value; no default |
| Organization | REQUIRED AT CREATION | Host scope and Venue relationship | Require explicit choice |
| Venue | REQUIRED AT CREATION | Location, timezone, authorization, public presentation | Require explicit choice |
| Capacity | REQUIRED AT CREATION | Per-Event/per-occurrence registration ceiling | `20` is convenient but requires Product approval; otherwise explicit choice |
| Event date | REQUIRED AT CREATION | First occurrence and recurrence anchor | Require explicit choice |
| Start time | REQUIRED AT CREATION | UTC schedule and recurrence template | Require explicit choice |
| End time | REQUIRED AT CREATION | Duration and overlap/ordering validation | Quick-duration shortcut is safe only after start |
| Recurrence/Series | QUESTIONABLE / PRODUCT DECISION | Creates series, rules, and multiple Events | Require explicit opt-in; no remembered recurrence |
| Series end date | QUESTIONABLE / PRODUCT DECISION | Generated occurrence count and series metadata | Prefer translated weeks/count plus explicit resolved date; do not silently default |
| Registration deadline | QUESTIONABLE / PRODUCT DECISION | Per-occurrence registration close | `At class start` may be safe; relative/preset model needs approval |
| Visibility | QUESTIONABLE / PRODUCT DECISION | Discovery/eligibility consequence | Require explicit choice; do not default to Public without approval |
| Access mode | QUESTIONABLE / PRODUCT DECISION | Public listing, direct link, or invitation requirement | Require explicit choice; explain combinations |
| Description | OPTIONAL AT CREATION | Participant-facing Event information | Safe to defer if publish review shows missing content |
| Arrival/what-to-bring | OPTIONAL AT CREATION | Participant preparation and confirmation content | Safe to defer only with clear operational warning |
| Communication link | OPTIONAL AT CREATION | Participant communication surface | Safe to omit; HTTPS authoritative validation |
| Communication-link label | OPTIONAL AT CREATION | Link wording; server defaults when URL exists | Sensible server fallback, but expose label consequence |
| Image | OPTIONAL AT CREATION | Event card/presentation asset | Safe to defer if default/empty state is acceptable; preserve upload cleanup |
| Venue timezone | SYSTEM-DERIVED | Local-to-UTC/DST interpretation | Never editable; show prominently |
| Occurrence count/first/last dates | SYSTEM-DERIVED | Confidence in generated series | Always show before commit/publish |

## Dependency map

| Field changed | Dependent state | Current behavior | Desired behavior | Risk |
|---|---|---|---|---|
| Organization | Valid Venue set; host scope | Client clears invalid Venue; server rejects mismatches | Clear and explain; require re-selection; preserve unrelated values | Wrong Venue or misleading form state |
| Venue | Timezone, UTC instants, DST, recurrence, deadline instants | Clock strings remain; server recalculates in new timezone | Warn/confirm and refresh summary; preserve authoritative conversion | Silent schedule shift |
| Event date | End-date default, deadline default, recurrence anchor | Untouched end/deadline may follow date; recurrence first row syncs | Show affected fields and occurrence count; confirm if customized state will shift | Wrong first occurrence/deadline |
| Start/end time | Duration, first recurrence row, deadline default | Quick duration updates end; recurrence first row syncs | Show derived duration and recurrence impact | Accidental schedule mutation |
| Recurrence toggle | Series end/rules/occurrence generation | Controls enable/disable; first row seeded from timing | Explicit opt-in and visible generated summary; retain temporary state with confirmation on disable | Accidental series or lost configuration |
| Series end date | Occurrence count and last occurrence | Client/server reject invalid/over-limit range | Live count and limit warning before submit | 100+ unintended dates |
| Visibility/access | Discovery, registration eligibility, recurring validity | Some combinations accepted; recurring Invite-only rejected server-side | Matrix-driven copy and prevention of contradictory choices | Event unreachable or overexposed |
| Capacity | Registration ceiling per occurrence | Default 20; copied into series occurrences | Label “per class”; require approved default and show in review | Overbooking/underfilled class |
| Registration deadline mode/value | Per-occurrence close times | Absolute first value; recurring offset derivation | Show resolved deadlines; preserve server validation | Registration closes unexpectedly |
| Communication URL/label | Participant link presentation | URL requires HTTPS; missing label defaults | Link/label pair with clear optionality and preview | Confusing or unusable communication path |
| Image | Event card and Storage lifecycle | Optional upload; validated/staged around atomic create | Preview/failure recovery as Audit 1; no unnecessary loss | Presentation gap or orphaned asset |

## Human-factors scenario disposition

| Scenario | Disposition | Rationale |
|---|---|---|
| End before start | PREVENT | Existing authoritative validation; surface inline and preserve state |
| Deadline after Event start | PREVENT | Existing authoritative validation; explain local timezone |
| Recurrence end before first date | PREVENT | Existing validation; show count/date relationship |
| Duplicate schedule | PREVENT | Existing client/server duplicate detection |
| Overlapping schedules | PREVENT | Existing client/server overlap detection |
| Wrong Venue for Organization | PREVENT | Existing server relationship/authorization guard; clarify Public Venue |
| Public Venue misunderstanding | WARN | Explain host Organization vs reusable location |
| Wrong timezone | WARN + ALLOW WITH CONFIRMATION on Venue change | Venue timezone is authoritative and not editable |
| Accidental recurrence | ALLOW WITH CONFIRMATION | Explicit opt-in plus occurrence summary before commit |
| Accidental Publish | ALLOW WITH CONFIRMATION | Pre-publish review and distinct primary CTA |
| 100+ unintended occurrences | PREVENT | Existing 104 limit plus live generated-count warning |
| Zero/implausible capacity | PREVENT for zero; WARN for implausible values | Keep positive server rule; Product must define whether high values need warning |
| Communication URL without meaningful label | WARN | Preserve server fallback but make visible |
| Conflicting visibility/access | PREVENT or WARN by Product matrix | Current enum combinations need explicit semantics |
| Organization changed after dependent data | PREVENT invalid Venue; WARN/confirm dependent reset | Clear invalid Venue and explain |
| Venue changed after time/Series | WARN + ALLOW WITH CONFIRMATION | Recalculate UTC/DST/recurrence meaning |
| Abandoning unsaved work | WARN | Audit 1 overlap; preserve state where safe |
| Network/RPC failure | WARN + RETRY | Audit 1 overlap; idempotency must prevent duplicate creation |
| Publish succeeds but refresh fails | WARN | Audit 1 overlap; state is committed and should offer direct navigation/retry |

## Visibility/access decision matrix requiring Product judgment

The current enum model is not sufficient evidence for final operator wording. The following matrix is a decision artifact, not an approved rule:

| Visibility | Access mode | Discoverability | Registration path | Provisional disposition |
|---|---|---|---|---|
| Public | Public | Public listing | Public page | Likely valid; simplest wording |
| Public | Unlisted | Ambiguous: public visibility vs unlisted access | Direct link | Product must define which wins |
| Public | Invite-only | Publicly discoverable but invitation-gated | Invitation link | Likely confusing; prevent or relabel |
| Affiliation restricted | Public | Restricted listing/eligibility | Public page subject to affiliation | Likely valid if clearly explained |
| Affiliation restricted | Unlisted | Restricted direct-link audience | Direct link subject to eligibility | Product wording required |
| Affiliation restricted | Invite-only | Restricted and invitation-gated | Invitation plus eligibility | Likely valid but high complexity |

## Product decisions required

Cycle 1 decisions are resolved by the Product Owner approval dated this task cycle; the list below is retained as decision history and no longer blocks the approved primary slice.

1. Should Capacity remain a hard-coded `20` default, become an explicit choice, or use an approved organization/venue default?
2. Should registration deadline use presets/relative offsets, absolute time, or a bounded combination for recurring Events?
3. Is the current two-axis Visibility + Access model required at creation, and which combinations are valid?
4. Should recurrence be expressed primarily as end date, weeks, occurrence count, or a combination translated to the existing backend?
5. Is a pre-submit review summary required for Draft as well as Publish?
6. Are optional participant instructions, communications, and image creation-time inputs or explicitly finishable in Manage Event?
7. Is Copy Event a post-pilot priority for repeat-admin efficiency?
8. May an affiliation-restricted Event be published without configured eligible Organizations?
9. Should same-Venue overlaps warn, require confirmation, or be blocked, and are cross-midnight Events intentionally unsupported?
10. Should recurring image multiplication be explained only, or should image/presentation completeness gate Publish?

## Cycle 1 technical implementation-boundary review

### Primary slice: one coherent Create Event UX & Workflow Hardening slice

Boundary: `UI ONLY + CLIENT STATE + VALIDATION`, with a small Server Action adjustment only where structured field errors or the unsupported restricted-visibility submission must be enforced server-side. Estimated complexity: `MEDIUM`.

UI/client-state work includes section order, Registration placement, consequence-based controls, removal/disablement of affiliation-restricted choice, optional-section collapse, Venue timezone presentation, Venue-change confirmation, Series progressive disclosure/drawer, occurrence preview, Draft-first CTA hierarchy, Publish review/confirmation, local unsaved-change warning, and optional local draft recovery if Engineering sizing keeps it bounded. No server-side autosave.

Server Action/validation work includes translating deadline presets to the existing `registrationDeadlineLocal` representation, rejecting tampered `AFFILIATION_RESTRICTED` submissions, preserving existing Zod/business validation, exposing field-linked errors, and retaining idempotent retry behavior. Existing `phase3_create_event_bundle` and `phase3_create_multi_schedule_bundle` RPCs remain unchanged.

No requirement in the approved primary slice requires a database schema migration, migration `0070`, recurrence persistence redesign, Event lifecycle change, authorization model change, or hosted data change. Existing authorization, Organization/Venue checks, UTC/DST conversion, occurrence limits, overlap/duplicate checks, atomicity, audit, image cleanup, and idempotency are protected acceptance boundaries.

### Conditional boundary: affiliation restriction

The approved pilot response is to remove/disable the unsupported choice and reject tampered Create Event submissions. This is a Create Event validation/action guard and does not require eligibility configuration. It must not alter existing public registration eligibility semantics. If implementation discovers that existing restricted Events or public registration behavior must change, classify `SHARED BOUNDARY — COORDINATION REQUIRED`, stop that portion, and return for Product/RC2 reconciliation.

### Shared RC2 assessment

Expected conflict is `LOW` for the primary slice when developed on a separate next-release line. The public-registration/eligibility boundary is conditionally shared only if the implementation expands beyond removing the unsupported Create Event option. Do not modify `codex/rc2-integration`, migrations `0065–0069`, hosted Supabase, Render, or Auto-Deploy. Do not reserve migration `0070`.

### Lifecycle status

The approved primary package is now `ENGINEERING ASSIGNED` to workstream `01a05916-6878-72e1-a9fa-eaee19c097ae` (`Curie`) for pre-implementation boundary reporting. The conditional eligibility workflow is not part of the assignment.

## Admin Events Control Board — Cycle 1 assignment

| Package | Product | Engineering | Independent QA | Integration | Current gate |
|---|---|---|---|---|---|
| Create Event UX & Workflow Hardening | APPROVED | ENGINEERING VALIDATED — implementation paused | NOT STARTED | NOT READY | WAITING — FINAL RC2 SHA NOT VERIFIABLE |

### Concurrency determination

The known RC2 candidate `c77a945023ee2656fe934910803726b004b48098` exists locally, but the current Admin Events surface has material overlap with RC2-touched files: `src/app/admin/events/page.tsx`, `src/lib/services/phase-3-actions.ts`, shared Admin Event components, `tests/e2e/phase-3.spec.ts`, and migrations `0066–0069`. Therefore Engineering may prepare the implementation/test plan from the candidate in an isolated worktree, but must wait for the final RC2 SHA before modifying shared implementation files. This is `LOW EXPECTED CONFLICT` only after that baseline is frozen; it is not zero conflict.

### Engineering boundary result

Engineering verified the existing Filter implementation in `admin-events-discovery.tsx` and `globals.css` and classified Series reuse as `GENERALIZED INTO A SHARED DRAWER`. The shared shell should own overlay/sheet layout, animation, backdrop dismissal, Escape handling, trigger-focus restoration, ARIA wiring, responsive sizing, and scrolling; Filter and Series retain separate content/state/validation. The existing Filter behavior must regress unchanged. The dedicated worktree remains clean at branch `codex/admin-events-create-hardening`, base/HEAD `c77a945023ee2656fe934910803726b004b48098`. No code or documentation was edited by Engineering.

Engineering status: `ENGINEERING VALIDATED` for the boundary review, implementation `BLOCKED — FINAL RC2 SHA UNAVAILABLE`.

### Orchestration cycle — final SHA verification

The Product Owner supplied the literal `<SHA>`, which does not identify a commit. No local ref or canonical release document provides a newer final RC2 SHA; `c77a945023ee2656fe934910803726b004b48098` remains documented as the candidate and rollback point. Shared-file compatibility therefore cannot be released against a final baseline. No new assignment was made and Engineering remains paused.

## Audit 2 disposition

Audit 1 and Audit 2 are verified against the referenced task threads and fully reconciled here. Cycle 1 approves the bounded primary hardening package and the pilot response for CE-013; CE-014, CE-015, CE-010, and CE-012 remain deferred. Engineering is not yet assigned pending acceptance of this technical boundary review.

CREATE EVENT OPERATOR AUDIT COMPLETE — READY FOR PRODUCT REVIEW
