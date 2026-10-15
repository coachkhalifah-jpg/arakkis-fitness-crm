# Decision log

This is a concise handoff log; the durable source records remain in `docs/DECISIONS.md` and the referenced migrations.

| Date/reference | Decision | Effect |
|---|---|---|
| 2026-07-28 / DEC-046 | Freeze the MVP requirements and architecture. | Future scope changes require a new decision and synchronized requirements/tests/design. |
| 2026-07-28 / DEC-007, DEC-003 | Host scope follows assigned host Organizations and Events; participant affiliation is distinct. | Prevents cross-Organization leakage. |
| 2026-07-28 / permission baseline | Organizations management is System Admin-only. | Direct routes and actions must reject Host Admins. |
| Current validated migration 0038 / J5 baseline | Host Admin Venue access is assigned-Organization scoped for read/create/update; archive remains System Admin-only. | Current canonical matrix preserves scoped Venue operations while legacy docs are synchronized. |
| 2026-07-28 / DEC-019 | Follow-up queue and global history are System Admin-only. | Host access remains event-operational only. |
| 2026-07-28 / DEC-022 | Event times use UTC plus IANA timezone; Venue timezone is the default source. | Prevents DST/timezone ambiguity. |
| 2026-07-28 / DEC-023, DEC-040 | Administrator access is invitation-controlled, assignment-bound, and cannot be self-expanded. | No public admin signup or assignment changes by invitees. |
| 2026-07-28 / DEC-046 | Participation acknowledgment remains provisional until legal approval. | Production registration stays fail-closed. |
| 2026-07-30 / DEC-048 | Deployment readiness is operational and environment-separated. | Local evidence does not imply hosted deployment or legal approval. |
| 2026-08-05 / `28b63d6` | Validated J5 checkpoint completed and backed up privately on GitHub. | Official current Arakkis baseline. |
| 2026-09-22 / DEC-058 / `f52da3f` | Accept tip `f52da3f` as the product candidate SHA. Calm recovery for disconnected `/manage-bookings` and expired confirmation (preserve public UI). Remember-this-device for all bookings; strongly encourage on confirmation. Events marks already-booked with manage links. Narrow engineering + QA only. | Product candidate freeze; supersedes DEC-055 presentation conflicts. |
| 2026-09-24 / DEC-059 | System Admin may issue a manual 72-hour participant manage/recovery link (copy-once; no auto-send). Consume is single-use and sets remember-device. Host Admin denied. | Operator recovery without accounts, OAuth, or automated messaging. |
| 2026-09-24 / DEC-060 / UAT-011 | Public registration no longer collects Goals. Keep `participants.goals` nullable for historical CRM; System Admin may still show existing goals read-only. | Public form friction reduction; no destructive column drop. |
| 2026-10-14 / DEC-061 / UAT-016 | Product reopens DEC-060: restore optional Goals free-text on public registration (max 500, plain text). Admin goals remain read-only. | Explicit PO authorization; restores prior collection path. |
| 2026-10-15 / DEC-064 / UAT-018 | Goals copy simplify: label only; placeholder “Share anything that would help your coach support you.”; remove “What are you working toward?” heading and old class-outcome placeholder. | PO Batch 6 UX_COPY on restored Goals. |
| 2026-10-14 / DEC-062 / UAT-014 | Phone-only auto-match for ACTIVE participants on public registration + walk-in; do not overwrite name/contact on match. Amends BR-071. | PO chose Option C; admin contact recovery is the correction path. |
| 2026-10-14 / DEC-063 / UAT-015 | People directory browses ACTIVE participants with org-style pagination; row opens full profile. | Removes search-only empty state for System Admin CRM. |
| 2026-10-15 / DEC-065 / UAT-019 | Schedule materialize copies from the canonical earliest occurrence; sibling field drift does not block Add day / Change / Extend. | Aligns with DEC-049 per-occurrence independence; removes false “conflicting default values” hard-stop. |
| 2026-10-15 / DEC-066 / UAT-021 | Remove registration optional-section heading “Tell us a little about you.” and subtext “This helps your coach understand your experience.” | Redundant with “Help us help you” + field labels after Goals copy simplify. |
| 2026-10-15 / DEC-067 / UAT-009 | After successful registration Remember, confirmation hides Remember UI via `remembered=1` + cookie resolve (identity RPC optional). | Closes duplicate prompt on post-book confirmation. |
| 2026-10-15 / DEC-068 | Public Events hub: next occurrence **per series weekday**, not one card for the whole series. | Multi-day series visible on `/events` without changing 14-day register window. |
| 2026-10-15 / hosted 0080 | Coach applied DEC-068 migration **0080** on hosted; public `/events` weekday cards PASS. | Tip SQL was already correct; missing hosted apply was the gap. |
| 2026-10-15 / timer migration | Take-home workout timer stream uses migration **0081** (draft #33’s `0076` collided with phone-match). | Preserve ordered migrations; supersede #33 numbering. |
| 2026-10-15 / DEC-069 | System Admin **Remove from People** soft-archives ACTIVE participants (migration 0082); no hard delete. | Directory clutter reduction; preserve history; block if upcoming bookings. |
