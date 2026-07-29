# 06 — Permissions Matrix

Legend:
- Yes: permitted
- Scoped: permitted only for assigned organizations/events
- No: prohibited

| Capability | Public Participant | Host Admin | System Admin |
|---|---:|---:|---:|
| Browse public open events | Yes | Yes | Yes |
| Submit registration | Yes | Yes | Yes |
| Select multiple dates | Yes | Yes | Yes |
| Download calendar entry | Yes, after success | Yes | Yes |
| Sign into admin area | No | Yes | Yes |
| View dashboard | No | Scoped | Yes |
| View events | Public only, subject to affiliation restriction | Scoped | Yes |
| Create event | No | No in MVP | Yes |
| Edit core event details | No | No | Yes |
| Submit event cancellation request | No | Scoped, assigned host events only | Yes |
| Directly cancel event | No | No | Yes |
| View permanently cancelled event/history | No | Scoped, assigned events only | Yes |
| View cancellation request/details | No | Scoped, assigned host events only | Yes |
| View roster | No | Scoped | Yes |
| View participant phone/email | No | Scoped, event-operational use | Yes |
| Add manual registration | No | Scoped | Yes |
| Add walk-in at available capacity | No | Scoped | Yes |
| Use Over-Capacity Override for walk-in | No | No | Yes |
| Cancel registration | No | Scoped | Yes |
| Check in participant | No | Scoped | Yes |
| Finalize attendance | No | Scoped | Yes |
| Correct attendance | No | Scoped | Yes |
| Export event roster | No | Scoped, authorized events only | Yes |
| View WhatsApp opt-in/sent status | No | Scoped, authorized events only | Yes |
| Store/edit event WhatsApp invitation link | No | No | Yes |
| Copy event WhatsApp invitation message | No | Scoped, authorized events only | Yes |
| Export opted-in WhatsApp participants | No | Scoped, authorized events only | Yes |
| Mark selected WhatsApp invitations Sent/reset Pending/mark Failed | No | Scoped, authorized events only | Yes |
| Search global participant directory | No | No | Yes |
| View global participant profile | No | No | Yes |
| View cross-organization history | No | No | Yes |
| View host-specific participant history | No | Scoped | Yes |
| View coach-only notes | No | No | Yes |
| Create/edit coach notes | No | No | Yes |
| View global follow-up queue | No | No | Yes |
| View/edit/copy/complete/dismiss participant follow-up tasks | No | No | Yes |
| View event-operational cancellation-notification status | No | Scoped, authorized events only | Yes |
| Update individual cancellation-notification delivery status | No | Scoped, assigned events only | Yes |
| Complete/dismiss overall cancellation-notification task | No | No | Yes |
| Reset SENT notification status | No | No | Yes |
| Change DECLINED or mark NOT_REQUIRED notification status | No | No | Yes |
| Complete With Exceptions | No | No | Yes, reason required |
| Manage organizations | No | No | Yes |
| Manage venues | No | No | Yes |
| Create/administer Host Admin users | No | No | Yes |
| Assign organization access | No | No | Yes |
| View system-wide reports | No | No | Yes |
| Export global participant list | No | No | Yes |
| Manually merge Participants | No | No | Yes |
| View/review possible-duplicate cases | No | No | Yes |
| Open attendance processing | No | Scoped | Yes |
| Reopen finalized attendance event | No | No | Yes |
| Accept administrator invitation | No | Yes, own invitation only | No |
| Manage administrator invitations | No | No | Yes |
| Manage acknowledgment versions/legal status | No | No | Yes |
| View acknowledgment acceptance evidence | No | No | Yes |
| Manage cancellation template versions | No | No | Yes |
| Resolve participant merge conflicts | No | No | Yes |
| Accept invitation with assigned organizations | No | Yes, own invitation only; assignments cannot change | No |
| Invalidate completed event attendance | No | No | Yes, exceptional reason/audit |

## Enforcement rules
1. Scope is based on Event.host_organization_id, not participant affiliation.
2. Host Admin assignment may include more than one organization.
3. Every scoped query must verify organization assignment server-side/data-layer.
4. Search and aggregate counts must be scoped; no leaking totals from other organizations.
5. Direct object access must be denied even when the user guesses an event or participant identifier.
6. Service-role database credentials must never be exposed to client code.
7. CSV exports must use the same scope as the screen.
8. Host Admin roster exports may include only participant name, phone, provided email, affiliation, registration status, and attendance status.
9. Host Admin roster exports must exclude global history, coach notes, follow-up history, and activity at other organizations.
10. Event cancellation is a System Admin-only direct action; cancelled events cannot be restored in MVP and Host Admin cancellation requests never finalize cancellation.
11. WhatsApp exports must be filtered to opted-in participants and the same authorized event scope as the roster.
12. No role may automatically add a participant to a WhatsApp group in MVP.
13. Host Admin cannot add a walk-in at full capacity; only System Admin may use a recorded Over-Capacity Override.
14. Host Admin may correct individual attendance for assigned events but cannot reopen the entire finalized event.
15. Only System Admin may access participant follow-up tasks and global follow-up history; cancellation-notification status is the sole event-operational exception.
16. Administrator invitation tokens and acceptance endpoints expose only the invitee's own invitation and never permit public signup.
17. Host Admin may update individual cancellation-notification delivery statuses for assigned events but cannot complete/dismiss the overall notification task.
18. Copying or exporting WhatsApp data never marks invitations SENT; explicit selected-Registration action is required.
19. Host Admins may update notification delivery records only for authorized Events. They may not reset SENT, change DECLINED, mark NOT_REQUIRED, complete normally, or Complete With Exceptions.
20. Only System Admin may publish/retire/revoke acknowledgment versions, manage immutable cancellation-template versions, resolve merge conflicts, activate invitation assignments, create Over-Capacity Overrides, or invalidate completed attendance.
21. Invitation acceptance cannot change organization assignments and cannot activate a Host Admin without active assignments.
22. Attendance cancellation and exceptional invalidation are System Admin-only and preserve immutable transition history.

## Post-MVP Phase 7 permissions

| Capability | Public Participant | Host Admin | System Admin |
|---|---:|---:|---:|
| View published public registration page | Yes, subject to availability/legal rules | Yes | Yes |
| Publish/unpublish event | No | Scoped only if explicitly enabled by Phase 7 implementation design | Yes |
| Pause/resume registration | No | Scoped only if explicitly enabled by Phase 7 implementation design | Yes |
| Edit public slug | No | Scoped only if explicitly enabled by Phase 7 implementation design | Yes |
| Copy/preview public URL | No | Scoped for authorized events | Yes |
| Generate/download event QR | No | Scoped for authorized events | Yes |
| Manage administrator invitations | No | No | Yes |
| Accept own administrator invitation | No | Own invitation only | No |

Phase 7 management actions remain server/data-layer authorized. Publicly visible events do not grant Host Admin management access, and a Host Admin cannot manage another organization’s event or invitation.
