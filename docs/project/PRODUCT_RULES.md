# Product rules

These rules are the current project baseline. A change requires an explicit Product Owner decision and synchronized tests/design documentation.

## Roles and scope

- `SYSTEM_ADMIN`: global administrative authority.
- `HOST_ADMIN`: assigned-Organization operational authority; no participant account is required for the public MVP.
- Participant identity is global, while primary affiliation, host Organization, Venue, and affiliation recorded at registration remain distinct.
- Organizations management is System Admin-only.
- System Admins manage all Venues. Host Admins may read/create/update only Venues belonging to assigned Organizations. Venue archive is System Admin-only.

## Events and registration

Events belong to a host Organization and Venue. Event creation validates capacity, deadlines, timezone, venue/Organization relationship, recurrence, image type/size, and authorization. Creation is atomic and idempotent by request identity. Publication and public slugs do not bypass authorization, capacity, registration windows, or legal gates.

Participants may select multiple Event dates; each successful selection creates a separate Registration. Capacity, deadlines, duplicate active registration, and partial success are evaluated per Event.

Public registration no longer collects Goals (DEC-060 / UAT-011). Optional fields on the public form remain limited to email, fitness experience, and referral source. Historical `participants.goals` values may still appear read-only on System Admin participant detail; the column stays nullable and is not dropped in this slice.

## Legal and participant data

Participation acknowledgment remains PROVISIONAL until legal approval. Production registration is fail-closed unless the approved legal configuration is present. Participants have no login in MVP. Global participant history, notes, participant search, and follow-up are System Admin-only; Host Admin data is event-operational and organization-scoped.

## Attendance and follow-up

Attendance uses `NOT_STARTED`, `OPEN`, `FINALIZED`, and `REOPENED`, with immutable/auditable transitions. Authorized admins may correct individual attendance; reopening a finalized Event is System Admin-only. Cancelled registrations do not become no-shows. First-ever attendance and finalized no-show processing create idempotent follow-up tasks. Messages are editable/copyable and manually sent; automated messaging is out of scope.

## Cancellation, archive, and history

System Admins directly cancel Events. Host Admins may submit scoped cancellation requests where enabled. Cancellation is permanent in MVP, preserves history, creates required notification work, and does not silently rewrite attendance. Organizations and Venues use archive semantics rather than destructive deletion. Historical audit and transition records are retained.

## Images and Storage

Design Asset management is System Admin-only. Event-image replacement binds Event, actor, purpose, exact asset type `EVENT_IMAGE_DESKTOP`, signature, and expiry. MIME and 5 MiB checks remain authoritative. Replacement preserves one active asset, audit history, rollback, and Storage cleanup behavior.

## Confirmation and remembered device (DEC-058 / DEC-059)

Confirmation tokens remain opaque, hashed, and expire after 24 hours. Remember-this-device is the supported return path for viewing and managing upcoming classes. Remember-device is strongly encouraged on confirmation with clear consent (default-checked; issuance only after successful booking or explicit confirmation save). On Events, remembered participants see already-booked classes as **Booked** with a manage link. Disconnected `/manage-bookings` and expired confirmation use calm PublicErrorState recovery (never an HTTP-style 404 feel) with Browse events / use a saved link / View your bookings. Already-registered errors include a recovery sentence. Preserve existing public UI patterns; no new design language.

System Admin may manually issue a 72-hour participant manage/recovery link from participant CRM (DEC-059). The URL is copy-once and sent by the operator (SMS/WhatsApp); nothing is sent automatically. Host Admin cannot issue or revoke. Consuming a valid link is single-use, sets the remember-device cookie, and reuses existing manage RPCs. Invalid links stay on calm recovery. No public self-serve magic-link request, participant passwords, or OAuth.
