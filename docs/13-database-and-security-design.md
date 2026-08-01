# 13 — Database and Security Design

This document is an implementation-ready physical design for the frozen MVP. It refines the logical model and technical proposal without adding product features, permissions, or workflows. It specifies PostgreSQL types and constraints in prose only; it intentionally contains no SQL, migrations, Supabase configuration, or application source code.

## 1. Design Principles

### Auditability

Actions that change operational or legally relevant state record the actor, timestamp, reason where required, previous state, new state, and request/correlation identifier. State-transition and merge records are append-only. A successful user-facing action and its audit record commit together.

### Immutable historical records

Registrations, attendance outcomes, acknowledgment acceptances, cancellation records, rendered cancellation messages, delivery transitions, merges, overrides, and general audit events are historical records. They are never silently overwritten or deleted. Participants, organizations, venues, and events with history are archived or deactivated instead of normally deleted.

### Least-privilege authorization

Authorization is enforced in server-side data access and PostgreSQL RLS. Frontend visibility is not a security boundary. System Admin has global access. Host Admin has only assigned host-organization event scope. Public registration has narrow, purpose-specific access and no participant-directory access.

### Organization isolation

Host scope is derived from `events.host_organization_id` and an active Admin Organization Assignment. Participant primary affiliation never grants event access. Every roster, search, aggregate, notification, and export query applies the same event-host scope.

### Idempotent workflows

Retries cannot create duplicate active registrations, attendance rows, follow-up tasks, cancellation records, notification tasks, notification recipients, or over-capacity overrides. Semantic keys and unique constraints back the application logic.

### Transaction safety

Capacity, cancellation, merge, invitation activation, token regeneration, and attendance finalization are transactional workflows. Mutations lock the narrowest authoritative rows needed to serialize competing operations, validate state after locking, and roll back the complete unit on failure.

### Scalability

Use narrow indexed operational tables, immutable append-only history, cursor pagination for large lists, bounded exports, and pre-aggregated or carefully indexed reporting paths. Keep participant identity global while keeping host-facing projections scoped.

### Backward compatibility

Use additive, forward-only migrations. Preserve historical status values and identifiers. New status or template versions must not reinterpret old records. API/data-access projections should tolerate nullable fields introduced for later versions while enforcing MVP invariants for new writes.

## 2. Physical Database Schema

### Common conventions

- Primary keys are `uuid` values generated server-side. No public identifier is sequential or derived from PII.
- Foreign keys use `uuid` and default to `ON DELETE RESTRICT` for historical parents. Join rows that have no independent history may use `ON DELETE CASCADE`, but only for archived/administrative cleanup paths that cannot remove historical business records.
- Business timestamps use `timestamptz` and are stored in UTC. `date` is used only for date-only values such as a postal or calendar concept; event instants are never stored as a naive timestamp.
- Required text uses `text NOT NULL`; bounded lengths are enforced in validation and, where material, a `CHECK (char_length(...))` constraint.
- Enumerated business states are represented by PostgreSQL enum types or constrained text values. The chosen representation must support additive migrations without rewriting historical rows.
- Every mutable operational table has `created_at timestamptz NOT NULL DEFAULT now()` and, where edits are permitted, `updated_at timestamptz NOT NULL DEFAULT now()`.
- Immutable historical tables have `created_at` or the relevant event timestamp but no ordinary update path.
- All application foreign keys and unique constraints are backed by indexes where PostgreSQL does not create one automatically.
- Deletes from application roles are denied for historical tables. Archival is represented by status/archive fields.

### `organizations`

Purpose: approved partner institutions/community affiliations, event hosts, and optional venue owners.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`; immutable.
- `name text NOT NULL`; `CHECK (char_length(btrim(name)) BETWEEN 1 AND 200)`.
- `organization_type text NULL`.
- Optional address fields: `street text NULL`, `city text NULL`, `state text NULL`, `postal_code text NULL`.
- `active_status text NOT NULL DEFAULT 'ACTIVE'`; allowed `ACTIVE`, `INACTIVE`, `ARCHIVED`.
- `created_at timestamptz NOT NULL DEFAULT now()`.
- `updated_at timestamptz NOT NULL DEFAULT now()`.
- `archived_at timestamptz NULL`.

Relationships and behavior:

- Referenced by event host, participant primary affiliation, registration historical affiliation, venue ownership, and admin assignments.
- Organization deletion is `RESTRICT` once referenced. Deactivation/archival preserves all history and prevents new assignments or use where the product rules require an active organization.
- Name uniqueness is recommended among active organizations using a normalized comparison value; historical names remain available for audit.

Indexes:

- Active-status/name index for administration and approved affiliation selection.
- Normalized-name index for duplicate organization review.

### `venues`

Purpose: physical event locations, distinct from host organizations.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `organization_id uuid NULL REFERENCES organizations(id) ON DELETE RESTRICT`; optional venue owner.
- `name text NOT NULL`; non-empty check.
- `street text NOT NULL`, `city text NOT NULL`, `state text NOT NULL`, `postal_code text NOT NULL`.
- `timezone text NOT NULL DEFAULT 'America/New_York'`; must be a valid IANA timezone identifier validated at the data boundary.
- `active_status text NOT NULL DEFAULT 'ACTIVE'`; allowed `ACTIVE`, `INACTIVE`, `ARCHIVED`.
- `created_at`, `updated_at` required UTC timestamps; `archived_at timestamptz NULL`.

Behavior and indexes:

- Venue timezone is the default inherited by new Events; changing it does not update existing Event timezones.
- Delete is restricted when referenced by an Event. Archive instead.
- Index `(organization_id, active_status)` supports venue administration.

### `participants`

Purpose: one global person identity across organizations and venues.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `first_name text NOT NULL`, `last_name text NOT NULL`; non-empty checks.
- `normalized_first_name text NOT NULL`, `normalized_last_name text NOT NULL`; deterministic matching/search forms.
- `display_phone text NOT NULL`; original/display value retained.
- `normalized_phone text NOT NULL`; normalized E.164 value. No global uniqueness constraint because shared household phones are allowed.
- `phone_country text NOT NULL`; selected/detected ISO country or documented country code.
- `email text NULL`; trimmed/display participant email.
- `normalized_email text NULL`; trimmed/lowercased comparison form; no provider-specific transformation.
- `primary_affiliation_organization_id uuid NULL REFERENCES organizations(id) ON DELETE RESTRICT`.
- `affiliation_other_text text NULL`.
- `fitness_experience text NULL`.
- `status text NOT NULL DEFAULT 'ACTIVE'`; allowed `ACTIVE`, `ARCHIVED`.
- `created_at`, `updated_at` required UTC timestamps; `archived_at timestamptz NULL`.

Constraints and behavior:

- Mobile phone is required; email is optional. `normalized_email` is null when email is null.
- Archive rather than delete a participant with any registration, attendance, follow-up, note, acknowledgment, or audit history.
- Contact conflicts during merge require explicit administrator selection; no silent overwrite.

Indexes:

- `(normalized_phone, normalized_first_name, normalized_last_name)` for conservative exact matching.
- Normalized name and phone indexes for System Admin participant search.
- Nullable normalized email index for case-insensitive lookup without using email as an automatic merge key.
- `(primary_affiliation_organization_id, status)` for scoped affiliation views.

### `events`

Purpose: one bookable fitness event occurrence.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `host_organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT`.
- `venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE RESTRICT`.
- `name text NOT NULL`; non-empty check.
- `description text NULL`, `participant_instructions text NULL`.
- `starts_at timestamptz NOT NULL`, `ends_at timestamptz NOT NULL`; `CHECK (ends_at > starts_at)`.
- `timezone text NOT NULL`; valid IANA identifier, inherited from Venue unless System Admin overrides.
- `capacity integer NOT NULL`; `CHECK (capacity > 0)`.
- `registration_deadline timestamptz NOT NULL`; interpreted/displayed in Event timezone and validated against event lifecycle rules.
- `status text NOT NULL DEFAULT 'DRAFT'`; `DRAFT`, `OPEN`, `CLOSED`, `COMPLETED`, `CANCELLED`.
- `visibility text NOT NULL DEFAULT 'PUBLIC'`; `PUBLIC`, `AFFILIATION_RESTRICTED`.
- Optional WhatsApp fields: `whatsapp_group_invite_url text NULL`, `whatsapp_invitation_message text NULL`.
- `attendance_processing_state text NOT NULL DEFAULT 'NOT_STARTED'`; `NOT_STARTED`, `OPEN`, `FINALIZED`, `REOPENED`.
- `created_by_admin_id uuid NOT NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- `created_at`, `updated_at` required UTC timestamps; `archived_at timestamptz NULL`.

Constraints and behavior:

- `capacity` cannot be saved below the count of active registrations; this is enforced in a locked transaction, not only by a row check.
- A cancelled Event is permanent in MVP. It cannot be restored and cannot accept registration, check-in, finalization, or No-Show outcomes.
- A `PUBLIC` Event may be attended by participants from any organization. `AFFILIATION_RESTRICTED` Events use `event_eligible_organizations`; invitation codes and membership verification are out of scope.
- Core event fields are System Admin-only. Host Admin operations are event-scoped.
- Delete is restricted once an Event has history; archive/status preserves it.

Indexes:

- `(status, starts_at)` for public schedule and upcoming events.
- `(host_organization_id, starts_at, status)` for Host Admin scope.
- `(registration_deadline, status)` for registration eligibility.
- `(attendance_processing_state, starts_at)` for event operations.

### `registration_groups`

Purpose: one public/admin submission transaction containing one Participant and zero or more independent Event Registrations.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE RESTRICT`.
- `submission_source text NOT NULL`; `PUBLIC`, `SYSTEM_ADMIN`, `HOST_ADMIN`, `WALK_IN`.
- `participation_acknowledgment_version_id uuid NOT NULL REFERENCES acknowledgment_versions(id) ON DELETE RESTRICT`.
- `participation_acknowledged_at timestamptz NOT NULL`.
- `data_use_acknowledgment_version_id uuid NOT NULL REFERENCES acknowledgment_versions(id) ON DELETE RESTRICT`.
- `data_use_acknowledged_at timestamptz NOT NULL`.
- Confirmation-token lifecycle is represented by the related `confirmation_tokens` table; the Registration Group itself does not duplicate token hashes or access counters.
- `submitted_at timestamptz NOT NULL DEFAULT now()`.
- `created_by_admin_id uuid NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- Optional idempotency key `idempotency_key text NULL` with uniqueness scoped to the submission actor/source where used.

Constraints and behavior:

- Referenced acknowledgment versions must be the exact accepted versions and may be used for new production registrations only when `APPROVED`.
- Participation and Data Use are separate required acknowledgments. WhatsApp disclosure is stored per Registration, not as a submission-wide consent.
- Exactly one active confirmation token exists per group. Token regeneration revokes the prior token.
- Deleting a group is restricted after any Registration or acknowledgment evidence exists.

Indexes:

- `(participant_id, submitted_at DESC)` for confirmation/profile history.
- Active-token lookup by hash and group.
- Registration-group lookup is indexed through `confirmation_tokens(registration_group_id, revoked_at, expires_at)`.

### `event_eligible_organizations`

Purpose: many-to-many eligibility join for Affiliation Restricted Events.

Fields:

- `event_id uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT`.
- `organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT`.
- `created_at timestamptz NOT NULL DEFAULT now()`.

Primary key: `(event_id, organization_id)`. Only System Admin manages the join. Public schedule/registration reads it only through a restricted Event projection. Host Admin reads it only for authorized Events. Deleting an Event or Organization is restricted while the join exists; archival preserves eligibility history.

Indexes:

- Primary key for Event eligibility checks.
- `(organization_id, event_id)` for finding restricted Events by eligible organization.

### `registrations`

Purpose: one Participant reservation for one Event.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `registration_group_id uuid NOT NULL REFERENCES registration_groups(id) ON DELETE RESTRICT`.
- `participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE RESTRICT`.
- `event_id uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT`.
- `affiliation_organization_id_at_registration uuid NULL REFERENCES organizations(id) ON DELETE RESTRICT`.
- `affiliation_other_text_at_registration text NULL`.
- `registration_status text NOT NULL DEFAULT 'REGISTERED'`; `REGISTERED`, `CANCELLED`.
- `registration_outcome text NOT NULL DEFAULT 'ACTIVE'`; `ACTIVE`, `PARTICIPANT_CANCELLED`, `ADMIN_CANCELLED`, `EVENT_CANCELLED`, `MERGED_DUPLICATE`.
- `registered_at timestamptz NOT NULL DEFAULT now()`.
- `cancelled_at timestamptz NULL`, `cancellation_reason text NULL`.
- `possible_duplicate_case_id uuid NULL REFERENCES possible_duplicate_cases(id) ON DELETE RESTRICT`.
- WhatsApp fields: `whatsapp_opt_in boolean NOT NULL DEFAULT false`, `whatsapp_invitation_status text NOT NULL DEFAULT 'NOT_APPLICABLE'` (`NOT_APPLICABLE`, `PENDING`, `SENT`, `FAILED`), `whatsapp_opt_in_at timestamptz NULL`, `whatsapp_disclosure_version_id uuid NULL REFERENCES acknowledgment_versions(id) ON DELETE RESTRICT`, `whatsapp_invitation_sent_at timestamptz NULL`, `whatsapp_invitation_sent_by_admin_id uuid NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- `created_by_admin_id uuid NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- `over_capacity_override_id uuid NULL`; foreign key added after `over_capacity_overrides` exists, `ON DELETE RESTRICT`.

Constraints and behavior:

- Partial unique constraint: at most one active `REGISTERED` row for `(participant_id, event_id)`. A cancelled row remains historical and does not consume capacity.
- `registration_outcome = ACTIVE` requires `registration_status = REGISTERED`; participant/admin/event cancellation outcomes require `registration_status = CANCELLED`; `MERGED_DUPLICATE` is a terminal archived outcome and cannot be active, attended, or reactivated.
- `EVENT_CANCELLED` is only written by event cancellation and is distinct from participant cancellation.
- `whatsapp_opt_in = true` requires `whatsapp_opt_in_at` and `whatsapp_disclosure_version_id`; opt-in is not copied across Events. Marking an invitation SENT never implies external delivery.
- An over-capacity Registration must reference exactly one immutable override; ordinary registrations must not reference one.
- Delete is restricted. Cancellation and merge archival preserve both the row and its audit history.

Indexes:

- Partial active-registration uniqueness index for duplicate prevention and race-safe conflict handling.
- `(event_id, registration_status)` for capacity, roster, and export queries.
- `(participant_id, event_id)` for history and duplicate checks.
- `(registration_group_id)` for confirmation results.
- `(event_id, whatsapp_opt_in, whatsapp_invitation_status)` for scoped WhatsApp roster/export.

### `attendance`

Purpose: one logical attendance outcome for a Registration.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `registration_id uuid NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE RESTRICT`.
- `status text NOT NULL DEFAULT 'NOT_RECORDED'`; `NOT_RECORDED`, `ATTENDED`, `NO_SHOW`, `EXCUSED`.
- `checked_in_at timestamptz NULL`.
- `finalized_at timestamptz NULL`.
- `updated_by_admin_id uuid NOT NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- `updated_at timestamptz NOT NULL DEFAULT now()`.

Constraints and behavior:

- A cancelled Registration or cancelled Event cannot become `NO_SHOW`. A cancelled Event cannot be finalized through the normal attendance operation.
- Attendance transitions are written to `attendance_transitions` in the same transaction.
- Before attendance opens, event cancellation creates no attendance rows. While attendance is OPEN, checked-in participants become `EXCUSED` (the approved equivalent), unchecked active registrations become `EVENT_CANCELLED`, and no No-Show is created.
- Standard cancellation after `FINALIZED` is blocked; exceptional invalidation preserves finalized rows and transition history.

Indexes:

- Unique `registration_id` is the primary lookup.
- `(status, updated_at)` supports attendance operations and indicators.

### `attendance_transitions`

Purpose: immutable history for every Attendance status or check-in/finalization transition.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `attendance_id uuid NOT NULL REFERENCES attendance(id) ON DELETE RESTRICT`.
- `from_status text NULL` for initial creation; `to_status text NOT NULL`.
- `changed_by_admin_id uuid NOT NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- `changed_at timestamptz NOT NULL DEFAULT now()`.
- `reason text NULL`; required for corrections, reopening-related changes, conflict overrides, and exceptional invalidation.
- `source text NOT NULL`; controlled values such as `CHECK_IN`, `FINALIZE`, `CORRECTION`, `REOPEN`, `CANCELLATION`, `INVALIDATION`, `MERGE`.

The table is append-only. No application role may update or delete rows.

Indexes:

- `(attendance_id, changed_at)` for history display.
- `(changed_by_admin_id, changed_at)` for audit review.

### `follow_up_tasks`

Purpose: participant follow-up work, including First Attendance and finalized No-Show tasks.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE RESTRICT`.
- `event_id uuid NULL REFERENCES events(id) ON DELETE RESTRICT`.
- `reason text NOT NULL`; controlled MVP reasons include `FIRST_ATTENDANCE` and `NO_SHOW`.
- `trigger_key text NULL`; unique for automated triggers, such as `first-attendance:{participant_id}` and `no-show:{registration_id}`.
- `due_at timestamptz NOT NULL`.
- `status text NOT NULL DEFAULT 'PENDING'`; `PENDING`, `COMPLETED`, `DISMISSED`.
- `suggested_message text NULL`, `completion_notes text NULL`.
- `created_at timestamptz NOT NULL DEFAULT now()`, `completed_at timestamptz NULL`.
- `completed_by_admin_id uuid NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.

Constraints and behavior:

- Unique non-null `trigger_key` makes first-attendance and no-show creation idempotent.
- Only System Admin can read or mutate participant follow-up tasks. Messages are copied manually; no delivery provider state belongs here.
- A correction reassesses the related no-show task without creating duplicates.

Indexes:

- `(status, due_at)` for the System Admin queue.
- `(participant_id, created_at DESC)` and `(event_id, reason)` for history and reassessment.

### `participant_notification_tasks`

Purpose: one overall participant-notification task per affected participant for an event cancellation.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE RESTRICT`.
- `event_id uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT`.
- `event_cancellation_id uuid NOT NULL REFERENCES event_cancellations(id) ON DELETE RESTRICT`.
- `notification_type text NOT NULL DEFAULT 'EVENT_CANCELLED'`.
- `status text NOT NULL DEFAULT 'PENDING'`; `PENDING`, `COMPLETED`, `DISMISSED`.
- `priority text NOT NULL DEFAULT 'HIGH'`; MVP cancellation tasks are `HIGH`.
- `template_version_id uuid NOT NULL REFERENCES cancellation_template_versions(id) ON DELETE RESTRICT`.
- `template_type text NOT NULL`; approved cancellation template type.
- `suggested_message text NOT NULL`.
- `event_starts_at_snapshot timestamptz NOT NULL`.
- `created_at timestamptz NOT NULL`, `due_at timestamptz NOT NULL` and equal to cancellation time.
- `completed_at timestamptz NULL`, `completed_by_admin_id uuid NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`, `completion_reason text NULL`.

Constraints and behavior:

- Unique `(participant_id, event_id, notification_type)` ensures exactly one overall task per affected participant and idempotent cancellation retry.
- Normal completion requires every affected active Registration recipient to be terminal. `Complete With Exceptions` requires a reason and preserves unresolved recipients in audit.
- Only System Admin completes or dismisses the task; Host Admin sees only scoped operational status.

Indexes:

- `(status, priority, due_at)` for the System Admin queue.
- `(event_id, status)` for cancellation operations.
- `(participant_id, event_id, notification_type)` unique lookup.

### `participant_notification_deliveries` (Notification Recipients)

Purpose: per-Registration manual notification recipient record for a cancellation task.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `participant_notification_task_id uuid NOT NULL REFERENCES participant_notification_tasks(id) ON DELETE RESTRICT`.
- `registration_id uuid NOT NULL REFERENCES registrations(id) ON DELETE RESTRICT`.
- `status text NOT NULL DEFAULT 'PENDING'`; `PENDING`, `SENT`, `FAILED`, `DECLINED`, `NOT_REQUIRED`.
- `channel text NOT NULL`; `WHATSAPP`, `SMS`, `EMAIL`, `PHONE`, `OTHER`.
- `sent_at timestamptz NULL`, `sent_by_admin_id uuid NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`, `delivery_note text NULL`.
- `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.

Constraints and behavior:

- Unique `(participant_notification_task_id, registration_id)` prevents duplicate recipients.
- Host Admin can update individual records only for assigned Events and only through permitted transitions. Only System Admin can reset SENT, change DECLINED, mark NOT_REQUIRED, or complete the overall task.
- `SENT` means manually recorded as sent; it does not assert delivery or read status.
- Every status transition creates an `notification_delivery_transitions` row in the same transaction.

Indexes:

- `(participant_notification_task_id, status)` for completion gating.
- `(registration_id)` for affected-registration lookup.
- `(status, updated_at)` for operational queues.

### `notification_delivery_transitions`

Purpose: immutable history of every notification-recipient state change.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `delivery_id uuid NOT NULL REFERENCES participant_notification_deliveries(id) ON DELETE RESTRICT`.
- `previous_status text NULL`, `new_status text NOT NULL`.
- `actor_admin_id uuid NOT NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- `changed_at timestamptz NOT NULL DEFAULT now()`.
- `channel text NOT NULL`, `note text NULL`.

Append-only; no application update/delete. Index `(delivery_id, changed_at)`.

### `event_cancellation_requests`

Purpose: Host Admin request awaiting System Admin review; a request never directly cancels an Event.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `event_id uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT`.
- `requested_by_admin_id uuid NOT NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- `reason text NOT NULL`, `urgency text NOT NULL`.
- `proposed_replacement_date date NULL`.
- `cancellation_type text NOT NULL`; `PERMANENT`, `RESCHEDULING_PLANNED`, `REPLACEMENT_DATE_TO_BE_ANNOUNCED`.
- `status text NOT NULL DEFAULT 'PENDING'`; `PENDING`, `APPROVED`, `REJECTED`, `WITHDRAWN`.
- `requested_at timestamptz NOT NULL DEFAULT now()`.
- Review fields: `reviewed_at timestamptz NULL`, `reviewed_by_admin_id uuid NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`, `review_decision text NULL`, `review_reason text NULL`.
- Withdrawal fields: `withdrawn_by_admin_id uuid NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`, `withdrawn_at timestamptz NULL`.

Constraints and behavior:

- One partial unique pending request per Event.
- Pending requests cannot be materially edited; withdraw and replace instead. A new request may follow REJECTED or WITHDRAWN.
- Rejection requires a reason. Approval is transactional and idempotent with the Event cancellation operation.
- Request history is retained; delete is restricted.

Indexes:

- `(event_id, status)` for request review and pending uniqueness.
- `(requested_by_admin_id, requested_at DESC)` for requester history.

### `event_cancellations` (Cancellation Records)

Purpose: immutable record of a confirmed cancellation action.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `event_id uuid NOT NULL UNIQUE REFERENCES events(id) ON DELETE RESTRICT`; cancellation is permanent in MVP.
- `cancelled_by_admin_id uuid NOT NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- `cancellation_type text NOT NULL`.
- `reason text NOT NULL`.
- `active_registrations_affected integer NOT NULL CHECK (active_registrations_affected >= 0)`.
- `confirmed_at timestamptz NOT NULL`.
- `template_version_id uuid NOT NULL REFERENCES cancellation_template_versions(id) ON DELETE RESTRICT`.
- `rendered_message_snapshot text NOT NULL`.
- `administrator_message_edits text NULL`.
- `replacement_event_id uuid NULL REFERENCES events(id) ON DELETE RESTRICT`; must be a published replacement Event when present.

No update/delete path is exposed. The record preserves who, when, why, type, affected count, selected template, and historical rendered text.

Indexes:

- `(cancelled_by_admin_id, confirmed_at DESC)` for audit review.
- `(replacement_event_id)` for rescheduling linkage.

### `cancellation_template_versions`

Purpose: immutable, versioned operational text for cancellation notifications.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `template_type text NOT NULL`; `PERMANENT_CANCELLATION`, `REPLACEMENT_DATE_PENDING`, `REPLACEMENT_EVENT_AVAILABLE`.
- `version integer NOT NULL CHECK (version > 0)`.
- `exact_text text NOT NULL`.
- `status text NOT NULL`; `DRAFT`, `PUBLISHED`, `RETIRED`.
- `created_at timestamptz NOT NULL DEFAULT now()`.
- `created_by_admin_id uuid NOT NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- `retired_at timestamptz NULL`.

Unique `(template_type, version)`. A published version is never edited; editing creates a new version. Historical cancellations retain their version and rendered snapshot. Only System Admin can manage versions.

Indexes:

- `(template_type, status, version DESC)` for current template lookup.
- `(created_by_admin_id, created_at DESC)` for audit review.

### `over_capacity_overrides`

Purpose: immutable authorization record for a System Admin over-capacity Registration.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `event_id uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT`.
- `registration_id uuid NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE RESTRICT`.
- `approved_by_admin_id uuid NOT NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- `reason text NOT NULL`.
- `capacity_at_override integer NOT NULL CHECK (capacity_at_override > 0)`.
- `active_registration_count_before integer NOT NULL CHECK (active_registration_count_before >= 0)`.
- `active_registration_count_after integer NOT NULL CHECK (active_registration_count_after > active_registration_count_before)`.
- `created_at timestamptz NOT NULL DEFAULT now()`.
- `source text NOT NULL`; `WALK_IN`, `ADMIN_REGISTRATION`, `OTHER`.

Event capacity does not change. The record survives Registration cancellation. Host Admin cannot create it. Index `(event_id, created_at DESC)`.

### `acknowledgment_versions`

Purpose: immutable versions of Participation Risk, Data Use, and WhatsApp Disclosure text.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `type text NOT NULL`; `PARTICIPATION_RISK`, `DATA_USE`, `WHATSAPP_DISCLOSURE`.
- `version integer NOT NULL CHECK (version > 0)`.
- `exact_text text NOT NULL`.
- `content_hash bytea NOT NULL`; hash of exact text and documented encoding.
- `effective_at timestamptz NOT NULL`.
- `retired_at timestamptz NULL`.
- `legal_status text NOT NULL`; `DRAFT`, `PROVISIONAL`, `APPROVED`, `RETIRED`, `REVOKED`.
- `created_at timestamptz NOT NULL DEFAULT now()`, `created_by_admin_id uuid NOT NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.

Unique `(type, version)`. Only APPROVED versions may be used in production. The Participation version remains PROVISIONAL until legal approval; this is the only known pre-production dependency. Retired/revoked versions cannot be used for new registrations. No update/delete of text, hash, or historical status that would alter acceptance meaning.

Indexes:

- `(type, legal_status, version DESC)` for current version lookup.
- `(effective_at, retired_at)` for date-effective selection.

### `acknowledgment_acceptances`

Purpose: immutable evidence that a Participant accepted a specific acknowledgment version in a Registration Group.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE RESTRICT`.
- `registration_group_id uuid NOT NULL REFERENCES registration_groups(id) ON DELETE RESTRICT`.
- `acknowledgment_version_id uuid NOT NULL REFERENCES acknowledgment_versions(id) ON DELETE RESTRICT`.
- `accepted_at timestamptz NOT NULL DEFAULT now()`.
- `acceptance_method text NOT NULL`.
- `ip_address inet NOT NULL`.
- `user_agent text NOT NULL`.

The exact version resolves through the immutable version row. Ordinary administrators cannot delete or alter evidence because a version is retired/revoked. Index `(participant_id, accepted_at DESC)`, `(registration_group_id, acknowledgment_version_id)`, and `(acknowledgment_version_id, accepted_at)`.

### `admin_profiles`

Purpose: authenticated administrator profile linked one-to-one to Supabase Auth.

Fields:

- `id uuid PRIMARY KEY`; equal to Supabase Auth user ID, with no independent public signup.
- `display_name text NOT NULL`.
- `email text NOT NULL`; normalized/verified administrator email.
- `role text NOT NULL`; `SYSTEM_ADMIN` or `HOST_ADMIN`.
- `status text NOT NULL`; `PENDING`, `ACTIVE`, `SUSPENDED`, `DEACTIVATED`.
- `created_at`, `updated_at` required UTC timestamps.

Constraints and behavior:

- Admin email is required and compared normalized. Invitation acceptance cannot activate a different email.
- `ACTIVE` Host Admin requires at least one active `admin_organization_assignments` row. Removing all active assignments suspends access.
- Auth user deletion is not a business-record deletion; profile is deactivated and history retained.
- Unique normalized email among non-deactivated profiles.

Indexes: `(role, status)`, normalized email, and active profile lookup by `id`.

### `admin_invitations`

Purpose: invite-only Host Admin provisioning.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `invited_email text NOT NULL`; normalized comparison value stored separately or deterministically derived.
- `role text NOT NULL DEFAULT 'HOST_ADMIN'`; MVP only supports HOST_ADMIN invitations.
- `status text NOT NULL DEFAULT 'PENDING'`; `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED`, `REPLACED`.
- `token_hash bytea NOT NULL UNIQUE`; cryptographically random token hash.
- `token_expires_at timestamptz NOT NULL` and `issued_at timestamptz NOT NULL`.
- `invited_by_admin_id uuid NOT NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- `accepted_auth_user_id uuid NULL` and `accepted_admin_profile_id uuid NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- `accepted_at`, `revoked_at`, `suspended_at`, `reactivated_at` as nullable `timestamptz` values.

Acceptance is single-use, transactional, and requires normalized Auth email equality. Invitees cannot choose or change organization assignments. Token deletion is restricted; status transitions and audit events preserve lifecycle.

Indexes: `(invited_email, status)`, `(status, token_expires_at)`, and accepted profile lookup.

### `admin_organization_assignments`

Purpose: active authorization relationship between an Admin Profile and an Organization.

Fields:

- `admin_profile_id uuid NOT NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- `organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT`.
- `created_by_admin_id uuid NOT NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- `created_at timestamptz NOT NULL DEFAULT now()`.
- `revoked_at timestamptz NULL`.

Primary key: `(admin_profile_id, organization_id)`. One active assignment per pair. Assignment changes are System Admin-only and audited. Index `(organization_id, revoked_at, admin_profile_id)` supports host scope.

### `admin_invitation_organizations`

Purpose: read-only organization assignments attached to a pending invitation before activation.

Fields:

- `invitation_id uuid NOT NULL REFERENCES admin_invitations(id) ON DELETE RESTRICT`.
- `organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT`.
- `created_at timestamptz NOT NULL DEFAULT now()`.

Primary key: `(invitation_id, organization_id)`. Invitees cannot modify assignments. Acceptance copies these rows transactionally to `admin_organization_assignments`; an active profile cannot exist without the intended assignments.

### `confirmation_tokens`

Purpose: confirmation-link token lifecycle and access metadata for a Registration Group.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `registration_group_id uuid NOT NULL REFERENCES registration_groups(id) ON DELETE RESTRICT`.
- `token_hash bytea NOT NULL UNIQUE`.
- `issued_at timestamptz NOT NULL DEFAULT now()`.
- `expires_at timestamptz NOT NULL`.
- `revoked_at timestamptz NULL`.
- `last_accessed_at timestamptz NULL`.
- `access_count integer NOT NULL DEFAULT 0 CHECK (access_count >= 0)`.

Partial unique constraint: one row with `revoked_at IS NULL` per Registration Group. The token is at least 256 bits of secure randomness before hashing, opaque, read-only, non-authenticating, and scoped to one submission. Validation defaults are 10 attempts per IP per 10 minutes and 3 regenerations per group per hour; repeated invalid attempts are logged in General Audit Events/security logs. Generic invalid-link responses prevent enumeration.

Indexes: unique hash lookup, `(registration_group_id, revoked_at)`, `(expires_at, revoked_at)`, and rate-limit lookup by a separately protected security-event projection rather than exposing token data.

### `possible_duplicate_cases`

Purpose: System Admin review queue for ambiguous or conflicting Participant matches.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `candidate_participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE RESTRICT`.
- `possible_match_participant_id uuid NULL REFERENCES participants(id) ON DELETE RESTRICT`.
- `source_registration_id uuid NULL REFERENCES registrations(id) ON DELETE RESTRICT`.
- `source_registration_group_id uuid NULL REFERENCES registration_groups(id) ON DELETE RESTRICT`.
- `matching_signals jsonb NOT NULL`.
- `normalized_values jsonb NOT NULL`.
- `status text NOT NULL DEFAULT 'OPEN'`; `OPEN`, `MERGED`, `DISMISSED`.
- `reviewed_by_admin_id uuid NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- `reviewed_at timestamptz NULL`, `review_notes text NULL`.
- `created_at timestamptz NOT NULL DEFAULT now()`.

At least one source or candidate relationship is required. Possible duplicate cases do not merge or overwrite Participants automatically. Only System Admin can review, merge, or dismiss. Delete is restricted. Index `(status, created_at)`, candidate/possible-match IDs, and source Registration.

### `participant_merges`

Purpose: immutable System Admin merge audit for a survivor and archived duplicate.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `surviving_participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE RESTRICT`.
- `archived_duplicate_participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE RESTRICT`.
- `merged_by_admin_id uuid NOT NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- `merged_at timestamptz NOT NULL DEFAULT now()`.
- `migrated_record_counts jsonb NOT NULL`.
- `merge_notes text NULL`.
- `contact_resolution jsonb NOT NULL`, `affiliation_resolution jsonb NOT NULL`, `attendance_conflict_resolution jsonb NOT NULL`.

The merge is irreversible in MVP. Contact conflicts require explicit retained values; all affiliations and acknowledgment acceptances remain preserved; duplicate same-Event registrations are archived as `MERGED_DUPLICATE`; attendance conflicts default to ATTENDED over NO_SHOW unless explicitly resolved with a reason. Index both participant foreign keys and `(merged_by_admin_id, merged_at)`.

### `participant_merge_conflicts`

Purpose: optional normalized child audit rows for each resolved merge conflict.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `participant_merge_id uuid NOT NULL REFERENCES participant_merges(id) ON DELETE RESTRICT`.
- `conflict_type text NOT NULL`; contact, affiliation, registration, attendance, or other approved conflict category.
- `affected_record_ids jsonb NOT NULL`.
- `selected_resolution jsonb NOT NULL`.
- `reason text NOT NULL`.
- `created_at timestamptz NOT NULL DEFAULT now()`.

This child table makes each conflict independently reviewable; it is append-only.

### `completed_event_invalidations`

Purpose: exceptional System Admin workflow required before a finalized Event can enter cancellation handling.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `event_id uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT`.
- `requested_by_admin_id uuid NOT NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- `confirmed_by_admin_id uuid NOT NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- `reason text NOT NULL`.
- `confirmed_at timestamptz NOT NULL DEFAULT now()`.
- `audit_event_id uuid NULL REFERENCES audit_events(id) ON DELETE RESTRICT`.

Unique one completed invalidation action per Event unless a future documented decision changes that rule. It never deletes or silently rewrites finalized Attendance or transition history.

### `participant_notes`

Purpose: System Admin-only coach/participant notes, included because they are explicitly subject to privacy and merge-history requirements.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE RESTRICT`.
- `note text NOT NULL`.
- `created_by_admin_id uuid NOT NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`.
- `visibility_scope text NOT NULL DEFAULT 'SYSTEM_ADMIN_ONLY'`; MVP only permits SYSTEM_ADMIN_ONLY.
- `created_at timestamptz NOT NULL DEFAULT now()`.
- `archived_at timestamptz NULL`.

Notes are re-associated with the survivor during merge and never included in Host or WhatsApp exports. Index `(participant_id, created_at DESC)`.

### `audit_events` (General Audit Events)

Purpose: append-only cross-domain audit trail for security, authorization, lifecycle, and administrative actions not fully represented by specialized history tables.

Fields:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `actor_admin_id uuid NULL REFERENCES admin_profiles(id) ON DELETE RESTRICT`; null only for explicitly logged anonymous/security events.
- `action text NOT NULL`.
- `entity_type text NOT NULL`, `entity_id uuid NULL`.
- `old_values jsonb NULL`, `new_values jsonb NULL`.
- `reason text NULL`.
- `request_id text NULL`.
- `ip_address inet NULL`, `user_agent text NULL` where security evidence requires it.
- `created_at timestamptz NOT NULL DEFAULT now()`.

No application update/delete. Sensitive values are redacted before writing; full phone/email/token values and raw token material are never placed in audit JSON. Index `(entity_type, entity_id, created_at)`, `(actor_admin_id, created_at)`, `(action, created_at)`, and `(request_id)`.

## 3. Entity Relationship Summary

| Relationship | Cardinality | Purpose and enforcement |
|---|---|---|
| Organization → Event | One-to-many | One host organization owns many Events; Host scope is derived from this FK. |
| Organization → Venue | One-to-many, optional | An organization may own/manage Venues; a Venue may be independent. |
| Venue → Event | One-to-many | Each Event occurs at one physical Venue; venue timezone seeds Event timezone only. |
| Organization ↔ Event through `event_eligible_organizations` | Many-to-many | Restricted Events may list eligible organizations without changing host ownership. |
| Organization → Participant | One-to-many, optional | Participant primary affiliation; it does not grant Host access. |
| Participant → Registration Group | One-to-many | A global Participant submits many transactions. |
| Registration Group → Registration | One-to-many | One multi-date submission creates separate per-Event Reservations. |
| Participant → Registration | One-to-many | Global identity has reservations across organizations. |
| Event → Registration | One-to-many | An Event has many reservations; active capacity counts these rows. |
| Registration → Attendance | One-to-one, optional until attendance exists | A reservation has at most one current outcome. |
| Attendance → Attendance Transition | One-to-many | Every attendance change has immutable history. |
| Participant → Follow-Up Task | One-to-many | A participant may have first-attendance/no-show and future approved task records. |
| Event → Follow-Up Task | One-to-many, optional | Event context supports task history and timing. |
| Event → Notification Task | One-to-many | One task per affected Participant for the cancellation type. |
| Event Cancellation → Notification Task | One-to-many | Every notification task is attributable to the confirmed cancellation that created it. |
| Participant → Notification Task | One-to-many | A participant may be affected by multiple cancelled Events. |
| Notification Task → Notification Recipient | One-to-many | Each affected Registration gets one recipient row. |
| Registration → Notification Recipient | One-to-many over time, one per task | The same Registration may be a recipient for distinct event tasks; task/registration is unique. |
| Notification Recipient → Notification Delivery Transition | One-to-many | Every status change is append-only. |
| Event → Cancellation Request | One-to-many | Requests remain historical; only one may be PENDING. |
| Event → Cancellation Record | One-to-one in MVP | A cancelled Event has one permanent confirmed cancellation record. |
| Cancellation Template Version → Cancellation Record | One-to-many | Many cancellations may use a published version; snapshots preserve historical text. |
| Event → Over-Capacity Override | One-to-many | Each controlled overbooking is tied to the Event. |
| Registration → Over-Capacity Override | Zero-or-one per Registration | Only an over-capacity Registration references its immutable authorization record. |
| Acknowledgment Version → Acknowledgment Acceptance | One-to-many | A version may be accepted by many Participants/groups. |
| Participant → Acknowledgment Acceptance | One-to-many | Historical evidence is retained per Participant. |
| Registration Group → Acknowledgment Acceptance | One-to-many | Each group stores separate Participation/Data Use acceptances; WhatsApp disclosure is per Registration. |
| Admin Profile ↔ Organization through `admin_organization_assignments` | Many-to-many | Host Admins may be assigned to multiple organizations; active assignments define scope. |
| Admin Invitation ↔ Organization through `admin_invitation_organizations` | Many-to-many | Pre-activation assignments are fixed by System Admin and copied atomically at acceptance. |
| Admin Invitation → Admin Profile/Auth User | Zero-or-one-to-one | One accepted invitation links to one authenticated admin profile. |
| Participant → Participant Merge | One-to-many as survivor or archived duplicate | Merge history preserves both identities and is irreversible. |
| Participant → Possible Duplicate Case | One-to-many as candidate or possible match | Ambiguous matching is queued for System Admin review without automatic merge. |
| Registration/Registration Group → Possible Duplicate Case | One-to-many, optional | The source submission that caused ambiguity remains linked for review. |
| Participant Merge → Merge Conflict | One-to-many | Each explicit conflict resolution is independently auditable. |
| Event → Completed Event Invalidation | One-to-many historical, one active action in MVP | Exceptional invalidation is separate from standard cancellation and preserves attendance history. |
| Any entity/action → Audit Event | One-to-many | General audit captures cross-domain lifecycle/security events. |

## 4. State Models

### Event Status

- `DRAFT → OPEN` when a valid event is published for registration.
- `OPEN → CLOSED` when registration closes, including deadline/capacity closure.
- `OPEN` or `CLOSED → COMPLETED` through the normal event lifecycle after operations conclude.
- `DRAFT`, `OPEN`, or `CLOSED → CANCELLED` only through the approved System Admin cancellation transaction; `FINALIZED` attendance requires exceptional invalidation first.
- `CANCELLED` is terminal in MVP. Restore is prohibited.
- Prohibited: Host Admin changing core event status/details, public status mutation, reopening a cancelled Event, or changing a cancelled Event into an active state.

### Registration Status

- `REGISTERED → CANCELLED` through participant cancellation or authorized admin cancellation, or event cancellation transaction.
- `CANCELLED` is terminal for the reservation row; a new registration is a new row and is subject to duplicate/capacity rules.
- Prohibited: `CANCELLED → REGISTERED`, deleting history, or changing status without the appropriate authorization/audit.

### Registration Outcome

- `ACTIVE` is valid only with `REGISTERED`.
- `PARTICIPANT_CANCELLED` is written only when the participant cancels.
- `ADMIN_CANCELLED` is written only for authorized administrative cancellation.
- `EVENT_CANCELLED` is written only by event cancellation and is not a participant cancellation or negative attendance signal.
- `MERGED_DUPLICATE` is written only by the System Admin merge transaction for the archived duplicate same-Event Registration, with `registration_status = CANCELLED`. It is distinct from participant/admin/event cancellation and cannot be reactivated.
- Cancellation outcomes require `CANCELLED`; an outcome cannot be silently changed to another cancellation reason.

### Attendance Processing State

- `NOT_STARTED → OPEN` by System Admin or assigned Host Admin for an authorized Event.
- `OPEN → FINALIZED` after explicit confirmation by an authorized admin.
- `FINALIZED → REOPENED` only by System Admin with reason/audit.
- `REOPENED → FINALIZED` after correction/reassessment and explicit confirmation.
- `CANCELLED` Events disable check-in/finalization; standard cancellation after `FINALIZED` is blocked.
- Prohibited: Host Admin reopening an entire finalized Event, finalizing cancelled-event No-Shows, or reopening a permanently cancelled Event.

### Attendance Status

- `NOT_RECORDED → ATTENDED` through check-in/finalization, or `NOT_RECORDED → NO_SHOW` for an active unchecked Registration during finalization.
- `NOT_RECORDED → EXCUSED` only through the approved cancellation-after-check-in behavior or authorized correction.
- `ATTENDED`, `NO_SHOW`, and `EXCUSED` may be corrected by authorized admins with reason/audit; corrections create transitions and reassess follow-up triggers.
- `NO_SHOW` is prohibited for cancelled Registrations and cancelled Events.
- Cancellation while OPEN preserves check-ins and uses `EXCUSED` for checked-in Participants; it creates no No-Show.

### Notification Status

- `PENDING → SENT`, `FAILED`, `DECLINED`, or `NOT_REQUIRED`.
- `FAILED → SENT` or `PENDING`.
- `SENT → PENDING` only by System Admin correction.
- `DECLINED → PENDING` only after a new participant request.
- `NOT_REQUIRED` is terminal for that recipient.
- Host Admin may update individual records only within assigned Event scope and may not reset SENT, change DECLINED, mark NOT_REQUIRED, or close the overall task.
- Normal overall completion is prohibited while any affected active recipient is PENDING or FAILED. System Admin Complete With Exceptions requires a reason.

### Cancellation Request Status

- `PENDING → APPROVED` or `REJECTED` by System Admin.
- `PENDING → WITHDRAWN` by the submitting assigned Host Admin or System Admin according to the approved workflow.
- `REJECTED`, `WITHDRAWN`, and `APPROVED` are terminal for that request.
- A new request may be created after REJECTED or WITHDRAWN; only one PENDING request exists per Event.
- Pending requests cannot be materially edited.

### Follow-Up Task Status

- New trigger-created task starts `PENDING`.
- `PENDING → COMPLETED` or `DISMISSED` by System Admin.
- Corrections can reassess a no-show task without creating duplicates; a task’s historical reason is not silently rewritten.
- `COMPLETED` and `DISMISSED` are terminal unless a future documented decision adds reopening.

### Admin Invitation Status

- `PENDING → ACCEPTED` after verified email/Auth linkage, assignment activation, and profile activation commit atomically.
- `PENDING → REVOKED`, `EXPIRED`, or `REPLACED` by the approved System Admin lifecycle.
- Terminal invitation statuses cannot be accepted or reused.
- Token resend/replacement invalidates the previous token; acceptance cannot change assigned organizations.

### Admin Status

- `PENDING → ACTIVE` only after invitation acceptance and active assignments.
- `ACTIVE → SUSPENDED` when System Admin suspends access or a Host Admin has no active organization assignments.
- `SUSPENDED → ACTIVE` only after System Admin reactivation and valid assignments.
- `ACTIVE` or `SUSPENDED → DEACTIVATED` for administrative deactivation; historical rows remain.
- System Admin access is global only while the profile is active; no public signup.

### Template Status

- `DRAFT → PUBLISHED` by System Admin.
- `PUBLISHED → RETIRED` by System Admin; historical cancellations continue referencing the retired version.
- No in-place edit of published text; a new version is required.
- `RETIRED` cannot become the current template again in MVP.

### Legal Status

- `DRAFT → PROVISIONAL` or `APPROVED`.
- `PROVISIONAL → APPROVED` or `RETIRED`.
- `APPROVED → RETIRED` or `REVOKED`.
- Only `APPROVED` can be used in production. `PROVISIONAL` is development/testing-only. `RETIRED` and `REVOKED` cannot be used for new registrations.
- Historical acceptance evidence remains unchanged under retirement/revocation.

## 5. Atomic Database Operations

The application must call narrow server-side transactions/RPCs rather than grant broad public table writes. Every operation validates authorization and current state after obtaining its locks.

### Participant registration

- Lock/match the normalized participant candidate set; create or select exactly one Participant under the conservative matching rule.
- Create Registration Group and both required acknowledgment acceptances, then create successful Registration rows.
- Roll back the group, acceptances, and rows if the requested transaction cannot establish required integrity; independent multi-date partial-success behavior is handled by the operation below.
- Retry with the same idempotency key returns the original result. A different retry uses the active-registration unique constraint to return Already Registered.

### Multi-date registration

- Validate each selected Event independently. Lock Event rows in deterministic UUID order to avoid deadlocks, then re-check status, deadline, visibility, eligibility, and capacity.
- Commit successful Events and record independent failure results for full/deadline/eligibility/duplicate outcomes. A failure for one Event does not roll back successful independent Event registrations.
- The Registration Group and participant identity are shared by the submission; no successful Registration is created without its group.
- Retry is idempotent per event/participant and idempotency key.

### Duplicate prevention

- Lock the relevant Participant candidate or use a transactionally safe insert; exact normalized phone/first/last matching may reuse an existing Participant.
- The partial unique active-registration constraint is authoritative under concurrency. Conflict maps to Already Registered rather than creating a duplicate.
- Ambiguous matches create a possible-duplicate case and do not auto-merge or overwrite contact data.

### Capacity enforcement

- Lock the Event row, re-count active `REGISTERED` rows, and compare with capacity immediately before insertion or capacity reduction.
- Capacity reduction rolls back if the new capacity is below the locked active count. Registration retries re-check capacity after locking.
- A registration transaction never cancels another Participant to make capacity available.

### Over-capacity override

- System Admin-only transaction locks Event, confirms the Event is full and the source/registration is valid, captures warning confirmation/reason/counts, creates the immutable Override, and creates the Registration referencing it.
- The published Event capacity is not changed. Host Admin and public paths cannot bypass the operation.
- Unique registration/override constraints make retry safe. Failure rolls back both the override and the resulting Registration.

### Attendance finalization

- Lock the Event and its active Registrations/Attendance rows in stable order. Confirm processing state is OPEN or REOPENED and the actor has event scope.
- Assign checked-in rows ATTENDED and unchecked active rows NO_SHOW; preserve cancelled rows and prohibited outcomes. Write Attendance Transition rows and idempotent follow-up tasks in the same transaction.
- A retry after FINALIZED is rejected or becomes a no-op according to the command idempotency key; it never duplicates tasks/transitions beyond the attempted state change.

### Attendance reopening

- System Admin locks the Event, confirms FINALIZED, requires reason, writes the reopen audit/transition, and changes processing state to REOPENED.
- Existing attendance outcomes remain until individually corrected. Re-finalization reuses trigger keys and cannot duplicate follow-up tasks.
- Failure rolls back the state/audit change. Repeated reopen commands are rejected after the first successful reopen.

### Event cancellation

- Lock Event and the PENDING request in one transaction; verify the Event is cancellable and request remains PENDING.
- Approve the request when applicable, mark Event CANCELLED, apply EVENT_CANCELLED outcomes, preserve registrations, create one Notification Task per affected Participant and one Recipient per affected Registration, store the template/rendered snapshot, and write specialized/general audit rows.
- Cancellation before attendance opens creates no Attendance. Cancellation while OPEN requires System Admin confirmation and preserves check-ins as EXCUSED; cancellation after FINALIZED requires the exceptional invalidation workflow first.
- Any failure rolls back all steps. Unique Event cancellation, pending-request, task, recipient, and outcome constraints make repeated approval idempotent.

### Participant merge

- System Admin locks survivor, duplicate, affected Registrations, Attendance, tasks, notes, and acknowledgment references in deterministic order.
- Validate explicit contact/affiliation/attendance conflict resolutions, preserve acknowledgment acceptances, retain one active same-Event Registration, archive duplicate rows as MERGED_DUPLICATE, reassign permitted history, create merge/conflict/audit records, and archive the source Participant.
- Any conflict or constraint failure rolls back the complete merge. The merge is irreversible after commit; a retry recognizes the recorded merge and does not duplicate migration.

### Admin invitation acceptance

- Lock the PENDING invitation and its assignment rows. Verify token, expiry, single-use status, invited-email/verified-Auth-email equality, and assignment validity.
- Create or confirm Auth linkage, link the Admin Profile, copy assignments, set profile ACTIVE, and set invitation ACCEPTED in one transaction. The profile cannot become ACTIVE first.
- Invalid, expired, mismatched, or replayed acceptance rolls back and reveals no other invitation. A retry after acceptance is a safe already-accepted result only for the same authenticated user.

### Confirmation token regeneration

- Lock the Registration Group’s active token row. Verify regeneration rate limits, revoke the current row, create a new secure random token hash, and commit the new active token atomically.
- If creation fails, the old token remains active; do not leave a group with two active tokens.
- A repeated request is governed by the regeneration limit and does not create multiple active tokens. Validation updates access metadata atomically and never exposes the token hash.

## 6. Row Level Security

RLS is enabled on every application table, including specialized history and join tables. Policies use `auth.uid()` to resolve `admin_profiles`, role, active status, and active organization assignments. Security-definer helper functions have fixed search paths, narrow grants, and cannot be called by anonymous users to bypass scope.

### Scope primitives

- `is_active_system_admin()` permits global administrative access only for an active System Admin.
- `has_active_host_access(organization_id)` checks active Host Admin assignment to that Organization.
- `has_event_access(event_id)` resolves Event → host Organization and calls the assignment check.
- `has_registration_event_access(registration_id)` resolves Registration → Event and applies the same check.
- Participant affiliation is never used as a Host authorization predicate.

### Table policy matrix

| Table | Anonymous participant | System Admin | Host Admin |
|---|---|---|---|
| `organizations` | Read only approved public affiliation values as needed; no writes | Full required admin access | Read only through authorized Event/venue context; no writes |
| `venues` | Read only through public Event projection | Full required admin access | Read through assigned Events; no writes |
| `participants` | No direct select/insert/update; use narrow registration RPC | Global read/write subject to audit and archive rules | Event-scoped projection only; no global search, merge, or direct unrestricted row access |
| `events` | Read public open schedule projection only; no direct writes | Global create/edit/copy/status/cancellation access | Read assigned Events and operate roster; no core-event writes or direct cancellation |
| `event_eligible_organizations` | Read only with restricted public Event projection | Full management | Read only for assigned/public event context; no writes |
| `registration_groups` | Create only through validated registration RPC; read only through its valid confirmation token | Global required access | Read only when tied to assigned Event roster; no unrelated groups |
| `registrations` | Create through RPC; confirmation token sees only its submission results | Global required access | Assigned Event registrations only; operational fields required by roster/export |
| `attendance` | No access | Global read/write/correct/reopen flows | Assigned Event read/write check-in/finalization/correction; no reopen |
| `attendance_transitions` | No access | Read/write only through transition service; no deletion | Read assigned Event operational history if UI requires; no deletion and only authorized transition creation |
| `follow_up_tasks` | No access | Global read/write/copy/complete/dismiss | No access |
| `participant_notification_tasks` | No access | Global read/write/complete/dismiss | Read event-operational status only for assigned Events |
| `participant_notification_deliveries` | No access | Global read/write/transition | Read/update individual rows only for assigned Events and allowed transitions |
| `notification_delivery_transitions` | No access | Read/write through transition service | Read assigned Event transitions; writes only through permitted delivery transition path |
| `event_cancellation_requests` | No access | Global review/create/manage | Create/withdraw/view only for assigned host Events; cannot approve/finalize |
| `event_cancellations` | No access | Global read/create | Read assigned Event history; cannot create/restore |
| `cancellation_template_versions` | No access | Create/publish/retire/read | No writes; may use selected rendered message for authorized Event operations |
| `over_capacity_overrides` | No access | Create/read global | Read assigned Event history; cannot create |
| `acknowledgment_versions` | Read only current required public versions through registration projection | Full lifecycle/legal-status access | No management; no global evidence access |
| `acknowledgment_acceptances` | Create through registration RPC; no direct read | Read global evidence; no ordinary deletion | No access |
| `admin_profiles` | No access | Global administration | Read only own profile/invitation-linked data; no role/assignment mutation |
| `admin_invitations` | No public signup; valid invite endpoint exposes only its own invitation | Global create/resend/revoke/suspend/reactivate | Accept only own valid invitation; cannot alter assignments |
| `admin_organization_assignments` | No access | Full assignment management | Read own active assignments only; no writes |
| `admin_invitation_organizations` | No access | Create/read/change before acceptance | Read own invitation assignments; no writes |
| `confirmation_tokens` | Validate through narrow token endpoint; no table access and no mutation except approved regeneration request path | Manage/revoke/regenerate through server workflow | No access |
| `participant_merges` | No access | Global read/create merge workflow | No access |
| `participant_merge_conflicts` | No access | Global read/create through merge workflow | No access |
| `possible_duplicate_cases` | No access | Global read/review/merge/dismiss | No access |
| `completed_event_invalidations` | No access | Create/read exceptional workflow | No access |
| `participant_notes` | No access | Global read/write/archive | No access |
| `audit_events` | No access | Global read; append through trusted server workflows | Read only scoped operational records where required; no arbitrary writes |

Anonymous registration is implemented by a narrowly parameterized RPC/server action that accepts only approved public fields, validates acknowledgments, and returns only that submission’s results. Anonymous users cannot query tables, enumerate IDs, access history, or set ownership/status/role fields. Confirmation access uses a hashed token endpoint and returns only the same Registration Group’s successful/failed results and calendar links.

Host Admin policies apply the Event host organization on every direct, aggregate, export, notification, and search query. A guessed UUID, alternate endpoint, or client-controlled organization ID cannot expand scope. Service-role credentials are server-only and are never exposed to browsers.

## 7. Identity Resolution

### Matching and normalization

1. Require mobile phone; email is optional.
2. Parse phone with a libphonenumber-compatible parser, defaulting to United States `+1` while allowing country selection. Store display/original phone, E.164 normalized phone, and country.
3. Trim and lowercase email for comparison and basic validation. Do not remove Gmail periods, plus-address tags, or apply provider-specific transformations.
4. Normalize first and last names using a deterministic documented normalization function for matching/search. Preserve display values separately.
5. Automatically match only when normalized E.164 phone, normalized first name, and normalized last name all match.
6. Email alone, phone alone, name alone, conflicting values, or shared household contacts never auto-merge.
7. Ambiguity creates or links a Possible Duplicate Case for System Admin review.

### Examples

- `(703) 555-1212`, `7035551212`, and `+1 703 555 1212` can resolve to the same E.164 phone when the selected country/parser confirms equivalence.
- `Taylor Smith` with the same normalized phone and both normalized names matches the existing Participant. A different last name with the same phone does not overwrite or auto-merge.
- An email case difference or surrounding whitespace is comparison-equivalent after normalization, but email is never sufficient for automatic identity resolution.
- A participant whose primary affiliation is ABC may register for an XYZ public Event; the Participant remains global, the Event host remains XYZ, and the Registration stores ABC as historical affiliation at registration.

### Merge workflow

Only System Admin may merge. The administrator selects the survivor, chooses retained primary phone/email when contacts conflict, preserves valid secondary/historical contacts, preserves all distinct affiliations while selecting the primary, and resolves same-Event registration and attendance conflicts explicitly. ATTENDED takes precedence over NO_SHOW by default. Acknowledgment acceptances are unchanged; Registrations, Attendance, Follow-Up Tasks, Notes, and history are re-associated; the duplicate Participant is archived. The merge and each conflict are immutable and irreversible in MVP.

## 8. Time and Timezone Strategy

- Store all instants as UTC `timestamptz` and store the Event’s IANA timezone in a separate `text` field.
- New Events inherit the Venue timezone unless System Admin overrides it. Venue timezone changes do not rewrite existing Events.
- Validate local date/time against the selected IANA timezone. Reject a nonexistent spring-forward local time; for a duplicated fall-back time require first/second occurrence selection and store the resulting UTC instant.
- Registration deadlines are interpreted, validated, displayed, and compared using the Event timezone, then stored as a UTC instant.
- Public/admin displays format UTC instants in the Event timezone and include an abbreviation or offset when needed to disambiguate.
- Calendar generation uses the Event timezone, correct start/end instants, venue, address, and instructions. The `.ics` representation must preserve timezone semantics; Google Calendar links use the same instants/timezone.
- Follow-up due times derive from the stored Event end instant, not from a later recalculation using a changed Venue timezone.
- The initial Venue timezone default is `America/New_York`.

## 9. Audit Strategy

### Immutable audit/history tables

| Table | Why it exists | Readers | Writers | Retention |
|---|---|---|---|---|
| `attendance_transitions` | Every attendance/check-in/finalization/correction transition | System Admin; scoped Host Admin operational history | Trusted attendance workflow only | Retain with Attendance/Registration history |
| `notification_delivery_transitions` | Every manual recipient status change | System Admin; scoped Host Admin operational status | Trusted notification transition workflow | Retain with cancellation task/history |
| `participant_merges` | Survivor/duplicate, migrated counts, conflict choices, irreversibility | System Admin only | System Admin merge transaction | Permanent with participant history |
| `participant_merge_conflicts` | Individual contact, affiliation, registration, and attendance resolutions | System Admin only | Merge transaction | Permanent with merge history |
| `acknowledgment_acceptances` | Legally reviewable acceptance evidence | System Admin only | Registration RPC / approved acceptance workflow | Retain unchanged through version retirement/revocation |
| `event_cancellations` | Confirmed cancellation actor, reason, type, affected count, message snapshot | System Admin; scoped Host Admin event history | Cancellation transaction | Permanent while Event history exists |
| `completed_event_invalidations` | Exceptional finalized-event cancellation authorization | System Admin only | Exceptional System Admin workflow | Permanent with finalized attendance |
| `over_capacity_overrides` | Reason and counts for every controlled overbooking | System Admin; scoped Event Admins as permitted | System Admin override transaction | Permanent with Registration/Event history |
| `audit_events` | Cross-domain lifecycle, authorization, security, and token-abuse events | System Admin; narrowly scoped operational views | Trusted server workflows and security logging | Retention period must be documented before production; never purge records needed for legal/operational history |

Specialized tables are authoritative for their domain; `audit_events` supplements them and does not replace their foreign keys or transition records. No ordinary administrator may delete or rewrite immutable records. IP addresses and user agents are retained only where required for acknowledgment/security evidence and must be protected as sensitive data.

## 10. Security

### Confirmation token security

- Generate at least 256 bits of cryptographically secure randomness.
- Store only a SHA-256 hash as `bytea`; never store or log the raw token.
- Keep one active token per Registration Group; regeneration revokes the previous token atomically.
- Token is opaque, read-only, valid for 24 hours, and scoped to one submission’s results/calendar links.
- It cannot authenticate a Participant, change/cancel registrations, edit data, or access history.
- Apply defaults of 10 validation attempts per IP per 10 minutes and 3 regenerations per group per hour. Return a generic invalid-link response after expiration/revocation and log repeated invalid attempts without logging token material.

### Invitation token security

- Generate a cryptographically random single-use token, store only its hash, and expire it after 72 hours.
- Bind acceptance to the invited normalized email and the authenticated/verified Auth email.
- Invalidate on acceptance, revocation, replacement, or expiry. Never expose other invitations or organization assignments.
- Acceptance is transactional so no active Host Admin can exist without intended assignments.

### Hashing strategy

- SHA-256 is used for opaque confirmation/invitation token lookup hashes as required by the frozen design; raw tokens are never stored.
- Acknowledgment content hashes cover exact immutable text and support evidence verification; content hashes are not secrets.
- Password management belongs to Supabase Auth; the application never stores passwords or production default credentials.

### Export authorization

- Generate exports server-side from the same scoped query used by the roster.
- Host Admin event-roster exports contain only approved name, phone, provided email, affiliation, registration status, and attendance status.
- WhatsApp exports require authorized Event scope and per-Registration opt-in; default to active opted-in Registrations. Cancelled/EVENT_CANCELLED rows require an explicit filter.
- Exclude global history, coach notes, follow-up history, other-organization activity, fitness experience, acknowledgment audit data, IPs, and internal IDs.
- Copying/exporting never changes invitation status; selected “Mark Invitation Sent” is the only status mutation.

### Sensitive-data protection

- Mobile phone, email, affiliation, IP address, user agent, notes, acknowledgment evidence, and invitation/token metadata are sensitive.
- Use narrow projections, RLS, server-side validation, redacted logs, and no PII in URLs or error messages.
- Do not expose service-role credentials, token hashes, audit JSON, or acknowledgment IP/UA data to the browser.
- Archive instead of destructive deletion where history exists. Retention and privacy notice must be finalized before production.

### Service-role responsibilities

The Supabase service-role client, if needed, is server-only and limited to narrowly justified workflows such as controlled provisioning, migrations, security-definer operations, or privileged audit writes. User-facing actions still perform explicit actor/role/scope checks; service-role access is not a substitute for authorization.

## 11. Performance

### Recommended query patterns

- Public schedule: indexed Event status/start/deadline projection with eligible-organization join only for restricted Events.
- Host roster: Event host scope first, then Registration status and Participant contact projection; never fetch global Participant history into the roster query.
- Attendance: Event → active Registrations → Attendance in one scoped query with indexed foreign keys.
- Follow-up: System Admin only, indexed by status/due time and participant/event history.
- Notification work: task status/priority/due, then recipient status; completion checks use indexed counts and conditional aggregation.
- Participant search: exact normalized phone first, then normalized name, optional normalized email; do not use unbounded substring scans across all PII.
- Audit/history: entity/time indexes with bounded date windows and cursor pagination.

### Pagination and exports

- Use keyset/cursor pagination ordered by `(created_at, id)` or `(starts_at, id)` rather than deep offsets.
- Display rosters in bounded pages while preserving stable event filters.
- Stream or queue large System Admin exports; Host exports remain event-scoped and bounded. Never construct a global export for Host Admin.

### Reporting

- Calculate first-time indicators from indexed finalized Attendance/Event joins using the current Event start timestamp.
- Avoid unbounded live joins for dashboards as volume grows; introduce approved reporting views/materialized aggregates only through a new documented technical decision if needed.
- General Audit Events are append-only and may become the largest table; partitioning by time is an implementation option requiring operational review, retention rules, and migration testing.

### Anticipated bottlenecks

- Capacity races and simultaneous event-day writes require row locking and careful transaction duration.
- Participant search may grow with global history; normalized indexes and bounded result sets are mandatory.
- Audit and transition tables grow monotonically; retention, partitioning, and archive strategy must be reviewed before production.
- Large multi-date registrations and exports must avoid holding locks while rendering responses or files.

## 12. Migration Plan

Migrations are forward-only, separately reviewable, and never delete historical rows. The sequence below expresses dependencies without generating SQL.

1. **Extensions and conventions:** UUID generation, UTC timestamp conventions, status/archive conventions, and helper validation primitives.
2. **Organizations and venues:** create organization/venue parents and timezone validation/defaults.
3. **Admin identity:** create Admin Profiles, Auth linkage assumptions, invitation tables, invitation-organization assignments, and active admin assignments.
4. **Events:** create Events, host/venue foreign keys, lifecycle/timezone/capacity fields, visibility, attendance processing state, and public schedule indexes.
5. **Participants:** create Participants, normalized contact/name fields, archive fields, and matching/search indexes.
6. **Acknowledgments:** create immutable Acknowledgment Versions and Acceptances before Registration Groups because groups reference exact versions.
7. **Registration Groups:** create submission records and confirmation-token lifecycle fields.
8. **Registrations:** create per-Event reservations, historical affiliation, outcomes, WhatsApp opt-in, and the partial active-registration uniqueness constraint.
9. **Attendance:** create one-to-one Attendance, processing support, and Attendance Transition History.
10. **Follow-up:** create Follow-Up Tasks and unique semantic trigger keys for first attendance and no-show.
11. **Cancellation templates and requests:** create versioned templates, Cancellation Requests, and immutable Cancellation Records.
12. **Notification operations:** create Notification Tasks, Notification Recipients, and recipient transition history with task/Registration uniqueness.
13. **Over-capacity and exceptional attendance:** create Over-Capacity Overrides and Completed Event Invalidations, then add the Registration/Event references that depend on them.
14. **Identity review:** create Possible Duplicate Cases, Participant Merges, Merge Conflicts, and Participant Notes.
15. **General audit:** create append-only Audit Events and redaction/security logging conventions.
16. **RLS and protected views/RPCs:** enable RLS on every table, add role/scope helper functions, public registration/confirmation projections, and admin-scoped operational paths.
17. **Indexes and concurrency validation:** add remaining query indexes, validate lock order, unique constraints, and retry/idempotency behavior against seeded concurrent tests.
18. **Seed/test data:** add only local deterministic organizations, venues, Events, and admin identities; never seed production credentials.

Each migration must include backward-compatible deployment notes, data backfill/rollback expectations, and acceptance-test coverage. No migration may silently reinterpret existing cancellation, attendance, acknowledgment, or notification history.

## 13. Traceability Matrix

The following matrix maps each major persisted table to its primary requirement, decision, and acceptance coverage. Cross-cutting requirements are also listed below the table.

| Table | Functional Requirements | Decisions | Acceptance Tests |
|---|---|---|---|
| `participants` | FR-008, FR-022–027, FR-030, FR-051–053 | DEC-002, DEC-010, DEC-016–017, DEC-039 | AT-004–005, AT-009–012, AT-021–022, AT-048–053, AT-085–087 |
| `organizations` | FR-028, FR-030–033, FR-043–044 | DEC-003, DEC-012, DEC-023, DEC-040 | AT-009, AT-017–022, AT-088–089 |
| `venues` | FR-001, FR-029, FR-058 | DEC-022, DEC-043 | AT-023–024, AT-058, AT-094–095 |
| `events` | FR-001–005, FR-006, FR-018–020, FR-028–033, FR-045–050, FR-056–058, FR-063, FR-066–067, FR-083–086 | DEC-003, DEC-009, DEC-012, DEC-014–015, DEC-020–022, DEC-027–035, DEC-043–045 | AT-006–008, AT-017–020, AT-036–047, AT-055–058, AT-063–074, AT-094–098 |
| `event_eligible_organizations` | FR-002, FR-006–009 | DEC-012 | AT-009, AT-021, AT-030 |
| `registration_groups` | FR-007, FR-011–014, FR-060–061, FR-079–082 | DEC-004, DEC-013, DEC-024–026, DEC-041–042 | AT-001–003, AT-023–025, AT-060–062, AT-090–093 |
| `registrations` | FR-007–017, FR-022–025, FR-045–047, FR-049–050, FR-051–053, FR-056, FR-063–068, FR-084–086 | DEC-004, DEC-007, DEC-009–011, DEC-014–017, DEC-020–021, DEC-031–035, DEC-039, DEC-044–045 | AT-001–009, AT-013–014, AT-036–047, AT-048–058, AT-063–074, AT-082–087, AT-096–098 |
| `attendance` | FR-018–021, FR-025, FR-054, FR-057–058, FR-085–086 | DEC-006, DEC-018, DEC-021–022, DEC-045 | AT-010–016, AT-027–028, AT-053, AT-056–058, AT-087, AT-097–098 |
| `attendance_transitions` | FR-021, FR-057, FR-085–086 | DEC-021, DEC-039, DEC-045 | AT-027–028, AT-056–057, AT-087, AT-097–098 |
| `follow_up_tasks` | FR-025, FR-034–038, FR-055 | DEC-005–008, DEC-018–019 | AT-010–016, AT-027–028, AT-054 |
| `participant_notification_tasks` | FR-046, FR-063–065, FR-069–070 | DEC-014, DEC-027–032, DEC-036–038, DEC-045 | AT-036–040, AT-063–068, AT-075–084, AT-097–098 |
| `participant_notification_deliveries` | FR-064, FR-067, FR-069–070 | DEC-028–030, DEC-034, DEC-036 | AT-040, AT-063–066, AT-069, AT-071, AT-075–078 |
| `notification_delivery_transitions` | FR-069–070 | DEC-036 | AT-075–078 |
| `event_cancellation_requests` | FR-045, FR-065, FR-073–074 | DEC-014, DEC-032, DEC-038 | AT-036, AT-045, AT-067, AT-082–084 |
| `event_cancellations` | FR-045–047, FR-063, FR-071–072, FR-074, FR-085–086 | DEC-014, DEC-027–031, DEC-037–038, DEC-045 | AT-036–047, AT-063–068, AT-079–084, AT-097–098 |
| `cancellation_template_versions` | FR-063, FR-071–072 | DEC-028, DEC-037 | AT-064, AT-079–081 |
| `over_capacity_overrides` | FR-017, FR-056, FR-084 | DEC-020, DEC-044 | AT-055, AT-096 |
| `acknowledgment_versions` | FR-008, FR-060, FR-062, FR-079–080 | DEC-013, DEC-024, DEC-026, DEC-041 | AT-060, AT-062, AT-074, AT-090–091 |
| `acknowledgment_acceptances` | FR-008, FR-011, FR-060, FR-080 | DEC-013, DEC-024, DEC-041 | AT-060, AT-073–074, AT-091 |
| `admin_profiles` | FR-042–044, FR-059, FR-077–078 | DEC-023, DEC-040 | AT-059, AT-088–089 |
| `admin_invitations` | FR-043, FR-059, FR-077–078 | DEC-023, DEC-040 | AT-059, AT-061, AT-088–089 |
| `admin_organization_assignments` | FR-031–033, FR-043, FR-077–078 | DEC-003, DEC-023, DEC-040 | AT-017–022, AT-059, AT-088–089 |
| `admin_invitation_organizations` | FR-043, FR-059, FR-077–078 | DEC-023, DEC-040 | AT-059, AT-088–089 |
| `confirmation_tokens` | FR-013–014, FR-061, FR-081–082 | DEC-025, DEC-042 | AT-061, AT-092–093 |
| `participant_merges` | FR-051–052, FR-075–076 | DEC-016, DEC-039 | AT-048–050, AT-085–087 |
| `participant_merge_conflicts` | FR-075–076 | DEC-039 | AT-085–087 |
| `participant_notes` | FR-026, FR-052, FR-055, FR-066 | DEC-011, DEC-019, DEC-039 | AT-020–022, AT-050, AT-054, AT-070, AT-086 |
| `completed_event_invalidations` | FR-086 | DEC-045 | AT-098 |
| `audit_events` | FR-021, FR-043–044, FR-046, FR-052, FR-056–057, FR-059–060, FR-064–065, FR-075–086 | DEC-014, DEC-020–026, DEC-029–032, DEC-036–045 | AT-027–028, AT-045, AT-050, AT-055–062, AT-065–067, AT-075–098 |

Coverage verification:

- FR-001–005 persist in Events, Venues, Organizations, Registrations, and audit records.
- FR-006–017 persist through public Event projections, Registration Groups, Registrations, Acknowledgments, Confirmation Tokens, and Calendar serializers; calendar files themselves are generated artifacts, not stored entities.
- FR-018–021 and FR-054–058 persist through Attendance, Attendance Transitions, Events, and Audit Events.
- FR-022–027 and FR-051–055 persist through Participants, Registrations, Attendance, Follow-Up Tasks, Notes, Possible Duplicate/Merge records, and scoped policies.
- FR-028–033 and FR-059 persist through Organizations, Venues, Events, Admin Profiles, and Assignments.
- FR-034–038 persist through Follow-Up Tasks and unique trigger keys.
- FR-039–041 are read-model/export requirements over the persisted tables and scoped serializers.
- FR-042–044 and FR-077–078 persist through Admin Profiles, Invitations, Assignments, and Audit Events.
- FR-045–050 and FR-063–074 persist through Events, Cancellation Requests/Records, Templates, Notification Tasks/Recipients/Transitions, Registrations, and audit records.
- FR-060, FR-062, FR-079–080 persist through immutable Acknowledgment Versions/Acceptances and deployment validation outside the database.
- FR-061, FR-081–082 persist through Confirmation Tokens and security audit events.
- FR-083–086 persist through Event timezone fields, Over-Capacity Overrides, Attendance Transitions, and Completed Event Invalidations.

## 14. Design Review

### Assumptions

- Supabase Auth `auth.users.id` is the authoritative identifier linked to `admin_profiles.id`.
- `EXCUSED` is the selected explicit attendance outcome for checked-in Participants when an Event is cancelled while attendance is OPEN, as allowed by the frozen decision.
- `participant_notification_deliveries` is the physical implementation of the approved Notification Recipient entity.
- A permanently cancelled Event has one confirmed Cancellation Record in MVP; all later operational work references that record rather than restoring the Event.
- General Audit Events supplement, but do not replace, specialized immutable history tables.
- Exact retention durations for IP/user-agent evidence and general security logs remain an operational/privacy policy input; no product behavior is changed by this design.

### Implementation risks

- Capacity, cancellation, and attendance transactions can deadlock if lock order is inconsistent; use deterministic Event/Registration ordering.
- Host scope can leak through aggregates or exports if authorization is applied after data retrieval; scope must be part of every query/RPC.
- Merge conflicts can lose data if the survivor/resolution payload is not validated before mutation; require a complete conflict plan.
- Token abuse controls require a trusted rate-limit store and careful privacy-safe logging.
- Append-only audit and transition tables may grow faster than operational tables and require a reviewed retention/partitioning strategy.
- Legal status and the Participation acknowledgment production gate must be enforced in deployment validation as well as the administrative UI.
- DST behavior must be tested against the actual timezone library/database boundary, not only browser formatting.

### Validation checklist

- [ ] Every table has a primary key, required foreign keys, delete behavior, and appropriate indexes.
- [ ] Active Registration uniqueness and capacity races are tested concurrently.
- [ ] Event cancellation is atomic, permanent, idempotent, and cannot create No-Shows.
- [ ] Finalized attendance cannot be cancelled through the standard path; exceptional invalidation is authorized and audited.
- [ ] Every Attendance and Notification Recipient transition creates immutable history.
- [ ] Notification completion is blocked by PENDING/FAILED recipients; Complete With Exceptions requires a reason.
- [ ] Host Admin cannot cross organization boundaries through direct IDs, aggregates, search, notifications, or exports.
- [ ] Public registration and confirmation endpoints expose only approved narrow projections.
- [ ] Participant matching requires normalized phone plus first/last name; merge conflicts require explicit choices.
- [ ] Invitation acceptance cannot activate the wrong email or an unassigned Host Admin.
- [ ] Acknowledgment versions/acceptances are immutable and production blocks PROVISIONAL Participation text.
- [ ] Confirmation/invitation tokens are hashed, opaque, expiring, single-active/single-use as applicable, and rate-limited.
- [ ] DST nonexistent and duplicated times have the approved behavior.
- [ ] WhatsApp exports contain only opted-in, authorized Event rows and never mark SENT by copying/exporting.
- [ ] No service-role credential reaches client bundles, logs, exports, or audit JSON.
- [ ] AT-001–AT-098 are mapped to unit, database/RLS, integration, or E2E tests as appropriate.

### Recommended engineering review questions

1. Does each Supabase RLS policy derive Host scope from Event host organization rather than participant affiliation?
2. Are public registration and confirmation operations narrow enough that anonymous users cannot infer other Participants, Events, or registration IDs?
3. Are capacity, cancellation, finalization, merge, and invitation transactions short, deterministic, and retry-safe under concurrency?
4. Are database constraints sufficient to prevent duplicate active Registrations, duplicate tasks/recipients, multiple active tokens, and invalid outcome/state combinations?
5. Does the schema preserve the exact acknowledgment text/version and rendered cancellation message used at the historical moment?
6. Can an auditor reconstruct every attendance, notification, cancellation, merge, override, invitation, and acknowledgment decision without relying on mutable application logs?
7. Are export projections enforced server-side and independently tested for field exclusions and organization scope?
8. How will audit/security retention, partitioning, backup, and privacy deletion requests be handled without deleting legally or operationally required history?
9. Does the deployment gate fail closed when no APPROVED Participation acknowledgment version exists?
10. Are DST, token abuse, Auth invitation mismatch, merge conflicts, cancellation rollback, and finalized-attendance exception scenarios covered by automated acceptance tests?

## 15. Post-MVP Phase 7 security addendum

DEC-047 extends this frozen-MVP design without changing prior tables or migrations. Phase 7 implementation must add only forward migrations after `0019` and preserve RLS, fixed `search_path`, least-privilege grants, append-only audit evidence, and server-only service credentials.

- Canonical URLs use a server-only `APP_BASE_URL`; local may fall back to localhost, while staging and production require valid HTTPS configuration. Trailing slashes are normalized and Host headers are ignored.
- Event publication is additive and must compose with existing Event status, cancellation, capacity, registration deadline, organization/venue state, and acknowledgment legal status. A narrow public slug lookup must not grant broad anonymous table access or leak unpublished data.
- Slugs are normalized, bounded, collision-safe, reserved-word protected, and unique among active public identities. Changes require authorization and audit; old-link behavior is explicitly tested before implementation.
- QR generation encodes exactly the canonical URL, supports an approved printable format and accessible text alternative, and never adds IDs, tokens, tracking, or analytics.
- Invitation acceptance must lock/condition the pending invitation, consume the single-use token atomically or use a documented recoverable boundary, and ensure exactly one active profile/assignment relationship under concurrent retries. Raw tokens are never stored after one-time display, logged, or included in analytics.
- System Admin has global authority. Host Admin publication management, if enabled, is restricted to assigned event host organizations. Anonymous and non-admin management access is denied. Publicly published status never grants management access.
- The legal gate must fail closed in the page, server action, and database/RPC path for production-like registration while Participation Risk is PROVISIONAL. Local synthetic registration remains allowed and staging remains non-production.

Phase 7 planned database assertions cover publication/availability, narrow public lookup, legal gating, slug uniqueness, token hashing/expiration/revocation/single-use, invitation concurrency, RLS isolation, audit evidence, and no raw-token leakage. These are pending implementation and are not complete.

### Self-review result

The design was reviewed against the frozen MVP requirements FR-001–FR-086, BR-001–BR-112, DEC-001–DEC-046, and AT-001–AT-098, plus the post-MVP extension FR-087–FR-105, BR-113–BR-136, DEC-047, and AT-099–AT-132. The Phase 7 addendum preserves the original baseline and records publication, canonical URL, slug, QR, invitation, environment, legal-gate, RLS, audit, and concurrency requirements as planned rather than implemented. No SQL migrations, Supabase configuration, or application source code are included. This document is ready for implementation review.
# DEC-052 security note

No schema or RLS changes are introduced. Quick-roster data is selected only for events already resolved through the authenticated administrator’s existing scope. Phone links are rendered only in the authorized operational event context, and global participant profile/follow-up access remains System Admin-only.

# Phase 9 security synchronization

Phase 9 preserves RLS, grants, server authorization, legal gate, audit controls, and migration
immutability. Operational controls, secret handling, headers, logging, recovery, and incident
response are documented in `docs/29`.
# DEC-051 security note

Remembered-device tokens are high-entropy opaque values, SHA-256 hashed in the database, scoped to `/register`, HttpOnly, SameSite=Lax, Secure in hosted production, and bounded to 180 days. Revocation removes the cookie and marks the server record revoked. Possession never grants access to profile history, administration, or unrelated organization data. SMS/phone OTP is not implemented.
