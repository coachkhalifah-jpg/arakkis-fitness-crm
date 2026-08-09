# Role and permission matrix

Canonical roles are `SYSTEM_ADMIN`, `HOST_ADMIN`, and unauthenticated public Participant. The matrix separates presentation from actual enforcement.

| Capability | Navigation visibility | Route access | Server action | RLS/data layer |
|---|---|---|---|---|
| Workspace | System Admin sees global modules; Host Admin sees assigned operational modules | Active admin required | N/A | Admin profile/assignment checks |
| Organizations | System Admin only | System Admin only; Host direct route denied | System Admin only | System Admin policy; Host cannot mutate |
| Venues | System Admin global; Host Admin Venue destination when assigned scope exists | System Admin global; Host Admin assigned-Organization only | System Admin global; Host create/update assigned Organization; archive System Admin-only | System Admin global policy; Host assigned Organization select/insert/update policies |
| Events | System Admin global; Host assigned Events | System Admin global; Host assigned host Organization | System Admin creation/core edits; scoped Host operational actions | Event host Organization scope |
| Design Assets | System Admin only | System Admin only | System Admin only | RLS and server-only Storage access |
| Participants/CRM/follow-up | System Admin only except event-operational Host projections | System Admin global; Host scoped event projections | System Admin global; Host approved event operations | RLS/data-layer scope |
| Registration | Public | Public routes subject to availability/legal rules | Validated public RPC/action | Narrow public projection and RPC |

Navigation never grants access. Every direct route, server action, RPC, Storage operation, export, search, and aggregate must repeat the relevant server/data-layer scope. Manipulated Organization, Venue, Event, asset, actor, and token identifiers must not expand access.

## Evidence note

The older `docs/06-permissions-matrix.md` and Phase 3 handoff describe Venue management as System Admin-only or Host read-only. The current validated implementation and migration `0038_batch_attendance_and_venue_scope.sql` explicitly implement assigned Host Venue select/insert/update, while keeping archive System Admin-only. This canonical document records the latest approved model requested for the streamlined project; the legacy documentation drift remains an item for requirements synchronization, not a reason to silently remove scoped access.
