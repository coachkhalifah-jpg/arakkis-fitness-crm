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
