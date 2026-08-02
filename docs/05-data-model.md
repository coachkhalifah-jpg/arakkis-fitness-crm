# 05 — Logical Data Model

This document defines business entities and relationships. It does not mandate exact table names or framework choices.

## Participant
Represents one person across all organizations.

Suggested fields:
- id
- first_name
- last_name
- normalized_first_name
- normalized_last_name
- normalized_phone
- display_phone
- phone_country
- normalized_email
- email
- primary_affiliation_organization_id, nullable for No affiliation
- affiliation_other_text, nullable
- fitness_experience, nullable
- status
- created_at
- updated_at
- archived_at

Relationships:
- has many Registration Groups
- has many Registrations
- has many Attendance records through Registrations
- has many Follow-Up Tasks
- has many Participant Notes

## Organization
Represents a partner institution or community affiliation.

Fields:
- id
- name
- type/category
- address fields, optional
- active_status
- created_at
- archived_at

Relationships:
- hosts many Events
- may be participant affiliation
- has many Admin assignments
- may own/manage many Venues

## Venue
Represents a physical event location.

Fields:
- id
- organization_id, nullable
- name
- street
- city
- state
- postal_code
- timezone, IANA identifier; default initial venue timezone is America/New_York
- active_status

Relationships:
- has many Events

## Event
One bookable occurrence.

Fields:
- id
- name
- host_organization_id
- venue_id
- starts_at
- ends_at
- timezone, IANA identifier; inherited from Venue unless overridden by System Admin
- capacity
- registration_deadline
- status
- visibility: PUBLIC or AFFILIATION_RESTRICTED
- description
- participant_instructions
- whatsapp_group_invite_url, nullable
- whatsapp_invitation_message, nullable/generated
- created_by
- created_at
- updated_at
- archived_at
- event_series_id, nullable; links a materialized occurrence to an Event Series
- series_occurrence_number, nullable; immutable positive ordinal within the series

Relationships:
- belongs to one Host Organization
- belongs to one Venue
- has many Registrations
- has many Follow-Up Tasks
- may have eligible organizations for affiliation-restricted registration
- may have Event Cancellation records and Cancellation Requests

## Event Series

An optional weekly recurrence definition that materializes independent Event occurrences. The
series stores the inclusive end date, canonical public slug, and a 14-day rolling participant
selection window. Occurrences retain their own capacity, deadline, publication, registration,
attendance, cancellation, and audit state; changing or deleting a series never rewrites history.

## DesignAsset

Represents a non-sensitive visual asset managed by a System Admin.

Fields:
- id
- asset_type
- event_id, nullable for global/category assets
- category_key, nullable for event/global assets
- storage_path
- original_filename, nullable display metadata only
- mime_type
- byte_size
- alt_text
- focal_position
- active
- created_by_admin_id
- created_at
- updated_at
- retired_at

Relationships:
- optionally belongs to one Event
- belongs to one creating System Admin
- has one public storage object while active

## RegistrationGroup
One public/admin submission transaction.

Fields:
- id
- participant_id
- submission_source: public, system_admin, host_admin, walk_in
- participation_acknowledgement_version
- participation_acknowledged_at
- data_use_acknowledgement_version
- data_use_acknowledged_at
- confirmation_token_hash
- confirmation_token_issued_at
- confirmation_token_expires_at
- confirmation_token_revoked_at, nullable
- confirmation_token_last_accessed_at, nullable
- confirmation_token_access_count
- submitted_at
- created_by_admin_id, nullable

Relationships:
- belongs to one Participant
- has many Registrations

## Registration
One participant reservation for one event.

Fields:
- id
- registration_group_id
- participant_id
- event_id
- affiliation_organization_id_at_registration, nullable
- affiliation_other_text_at_registration, nullable
- registration_status
- registered_at
- cancelled_at
- cancellation_reason, nullable
- registration_outcome: ACTIVE, PARTICIPANT_CANCELLED, ADMIN_CANCELLED, or EVENT_CANCELLED
- possible_duplicate_case_id, nullable
- whatsapp_opt_in, default false
- whatsapp_invitation_status: NOT_APPLICABLE, PENDING, SENT, or FAILED
- whatsapp_opt_in_at, nullable
- whatsapp_disclosure_version_id, nullable
- whatsapp_invitation_sent_at, nullable
- whatsapp_invitation_sent_by_admin_id, nullable
- created_by_admin_id, nullable

Constraints:
- unique active participant/event registration
- valid event relationship

An over-capacity Registration must reference its immutable Over-Capacity Override record. WhatsApp disclosure consent resolves to the immutable WhatsApp acknowledgment version.
- historical affiliation retained
- `EVENT_CANCELLED` is distinct from participant/admin cancellation and cannot produce No-Show attendance

Relationships:
- belongs to Participant
- belongs to Event
- belongs to Registration Group
- has zero or one logical Attendance result

## Attendance
Logical attendance outcome for a Registration.

Fields:
- id
- registration_id
- status: NOT_RECORDED, ATTENDED, NO_SHOW, or EXCUSED
- checked_in_at
- finalized_at
- updated_by_admin_id
- updated_at

Implementation note:
Attendance may be a separate table or physically represented on Registration, but the logical distinction must be preserved.

Cancelled events disable check-in and attendance finalization. Registrations affected by event cancellation remain historical and cannot be finalized as No-Show.

## EventEligibleOrganization

Join entity for an Affiliation Restricted Event and an eligible Organization.

Fields:
- event_id
- organization_id
- created_at

Constraint:
- unique event/organization pair

## EventCancellationRequest

Host-submitted request awaiting System Admin action.

Fields:
- id
- event_id
- requested_by_admin_id
- reason
- urgency
- proposed_replacement_date, nullable
- cancellation_type: PERMANENT, RESCHEDULING_PLANNED, or REPLACEMENT_DATE_TO_BE_ANNOUNCED
- status: PENDING, APPROVED, REJECTED, or WITHDRAWN
- requested_at
- reviewed_at, nullable
- reviewed_by_admin_id, nullable
- review_decision, nullable
- review_reason, nullable
- withdrawn_by_admin_id, nullable
- withdrawn_at, nullable

Host Admin requests are limited to events hosted by assigned organizations. Approval does not itself replace the confirmed cancellation record.

## EventCancellation

Immutable record of a confirmed event cancellation.

Fields:
- id
- event_id
- cancelled_by_admin_id
- cancellation_type
- reason
- active_registrations_affected
- confirmed_at
- template_version_id
- rendered_message_snapshot
- administrator_message_edits, nullable
- replacement_event_id, nullable; must reference a published Event

Constraint recommendation:
- one record per cancellation action; cancelled events remain permanently cancelled in MVP

## ParticipantNotificationTask

Participant-facing operational task created by an event cancellation.

Fields:
- id
- participant_id
- event_id
- notification_type: EVENT_CANCELLED
- status: PENDING, COMPLETED, or DISMISSED
- priority: HIGH
- template_type: PERMANENT, REPLACEMENT_DATE_TO_BE_ANNOUNCED, or REPLACEMENT_EVENT_AVAILABLE
- suggested_message
- event_starts_at_snapshot
- created_at
- due_at
- completed_at, nullable
- completed_by_admin_id, nullable

Constraint recommendation:
- unique participant/event/notification_type so cancellation processing is idempotent

## ParticipantNotificationDelivery

Per-Registration delivery tracking for an event-cancellation notification task.

Fields:
- id
- participant_notification_task_id
- registration_id
- status: NOT_REQUIRED, PENDING, SENT, FAILED, or DECLINED
- channel: WHATSAPP, SMS, EMAIL, PHONE, or OTHER
- sent_at, nullable
- sent_by_admin_id, nullable
- delivery_note, nullable

`SENT` records manual administrator action only; it does not assert delivery or read status. Authorized Host Admins may update individual deliveries for assigned events; only System Admin completes/dismisses the overall task.

Allowed transitions are PENDING to SENT, FAILED, DECLINED, or NOT_REQUIRED; FAILED to SENT or PENDING; SENT to PENDING only by System Admin; and DECLINED to PENDING only after a new participant request. Store a transition record for every change with previous/new state, actor, timestamp, channel, and optional note. Enforce unique task/registration delivery pairs. Normal overall completion requires all affected active Registrations to be terminal; Complete With Exceptions stores a reason and unresolved recipients.

## PossibleDuplicateCase

System Admin review case created when participant matching is ambiguous or conflicting.

Fields:
- id
- candidate_participant_id(s)
- source registration or submission id
- matching signals and normalized values
- status: OPEN, MERGED, DISMISSED
- reviewed_by_admin_id, nullable
- reviewed_at, nullable
- review_notes, nullable

## ParticipantMerge

Audit record for a System Admin-only manual merge.

Fields:
- id
- surviving_participant_id
- archived_duplicate_participant_id
- merged_by_admin_id
- merged_at
- migrated record counts
- merge notes

The merge transaction migrates registrations, attendance, follow-ups, notes, and history, enforces the active-registration uniqueness rule, preserves audit data, and archives the duplicate.

## AcknowledgmentVersion

Immutable published text/version record.

Fields:
- id
- type: PARTICIPATION_RISK, DATA_USE, or WHATSAPP_DISCLOSURE
- version
- exact_text
- content_hash
- effective_at
- retired_at, nullable
- legal_status: DRAFT, PROVISIONAL, APPROVED, RETIRED, or REVOKED

Candidate participants and source Registration/RegistrationGroup are explicit foreign-key relationships.

## AcknowledgmentAcceptance

Historical acceptance linked to a Participant and RegistrationGroup.

Fields:
- id
- participant_id
- registration_group_id
- acknowledgment_version_id
- accepted_at
- acceptance_method
- ip_address
- user_agent

Historical acceptance resolves through the immutable AcknowledgmentVersion record.

## AdminInvitation

Invite-only administrator provisioning record.

Fields:
- id
- invited_email
- role: HOST_ADMIN
- status: PENDING, ACCEPTED, REVOKED, EXPIRED, or REPLACED
- token_hash
- token_expires_at
- invited_by_admin_id
- organization assignments
- accepted_at, revoked_at, suspended_at, reactivated_at, nullable
- accepted_auth_user_id, nullable
- accepted_admin_profile_id, nullable

Tokens are single-use, hashed, cryptographically random, expire after 72 hours, and are invalidated on acceptance, revocation, or replacement.

Organization assignments are stored in an invitation-organization join entity and are copied transactionally to AdminUser organization access at acceptance. An ACTIVE Host Admin must always have the intended active assignments.

## AdminInvitationOrganization

Join entity linking a pending AdminInvitation to an assigned Organization. Invitees cannot create, remove, or alter these rows.

Fields:
- invitation_id
- organization_id
- created_at

## CancellationTemplateVersion

Immutable published template record.

Fields:
- id
- template_type: PERMANENT_CANCELLATION, REPLACEMENT_DATE_PENDING, or REPLACEMENT_EVENT_AVAILABLE
- version
- exact_text
- status
- created_at
- created_by_admin_id
- retired_at, nullable

Published edits create a new version. EventCancellation stores the selected version, rendered-message snapshot, and administrator edits. Replacement links resolve only to published replacement Events using canonical public URLs; Draft replacements omit the link.

## NotificationDeliveryTransition

Immutable state-transition record.

Fields:
- id
- delivery_id
- previous_status
- new_status
- actor_admin_id
- changed_at
- channel
- note, nullable

## ParticipantMergeConflict

Auditable conflict-resolution record linked to a ParticipantMerge, conflict type, affected records, selected resolution, and reason. Contact conflicts require explicit retained values; attendance conflicts default to ATTENDED over NO_SHOW unless explicitly changed.

## ConfirmationTokenAccess

Fields:
- registration_group_id
- token_hash
- issued_at
- expires_at
- revoked_at, nullable
- last_accessed_at, nullable
- access_count

Only one active token exists per RegistrationGroup. Repeated invalid attempts and rate-limit events are written to audit/security logs.

## OverCapacityOverride

Immutable record linked to one Event and resulting Registration.

Fields:
- event_id
- registration_id
- approved_by_admin_id
- reason
- capacity_at_override
- active_registration_count_before
- active_registration_count_after
- created_at
- source: WALK_IN, ADMIN_REGISTRATION, or OTHER

Event capacity is unchanged and the record survives Registration cancellation.

## AttendanceTransition

Immutable record for every Attendance change.

Fields:
- attendance_id
- from_status
- to_status
- changed_by_admin_id
- changed_at
- reason
- source

Cancellation before attendance opens creates no Attendance records. Cancellation while OPEN preserves check-in history, uses EXCUSED for checked-in Participants or the approved equivalent, marks unchecked active Registrations EVENT_CANCELLED, and creates no No-Show. Cancellation after FINALIZED requires exceptional invalidation and preserves finalized history.

## CompletedEventInvalidation

Exceptional System Admin action required before a finalized Event can enter the cancellation workflow.

Fields:
- id
- event_id
- requested_by_admin_id
- confirmed_by_admin_id
- reason
- confirmed_at
- audit record reference

It does not delete or rewrite finalized Attendance or AttendanceTransition records.

## Attendance processing

Event attendance processing has state NOT_STARTED, OPEN, FINALIZED, or REOPENED. Store state transition actor, timestamp, and reason where applicable. Reopening is System Admin-only; opening, finalization, and individual correction are authorized event operations.

## AdminUser/Profile
Authenticated administrator profile.

Fields:
- id linked to auth user
- display_name
- email
- role: SYSTEM_ADMIN or HOST_ADMIN
- status
- created_at

## AdminOrganizationAccess
Many-to-many assignment between Host Admin and Organization.

Fields:
- admin_user_id
- organization_id
- created_at
- created_by

Constraint:
- unique pair

## FollowUpTask
Fields:
- id
- participant_id
- event_id, nullable where future manual tasks exist
- reason
- trigger_key
- due_at
- status
- suggested_message
- completion_notes
- created_at
- completed_at
- completed_by_admin_id

Constraint recommendation:
Unique trigger key for one-time automated tasks, including `first-attendance:{participant_id}` and `no-show:{registration_id}`. Reprocessing attendance finalization or correction must not create duplicate tasks.

## ParticipantNote
Fields:
- id
- participant_id
- note
- created_by_admin_id
- created_at
- visibility_scope, default SYSTEM_ADMIN_ONLY

## Audit metadata
At minimum preserve who and when for:
- attendance corrections
- registration cancellation
- admin assignment changes
- event status changes
- event cancellation, including reason, type, actor, timestamp, and affected active-registration count
- event cancellation request submission and review
- participant merges and possible-duplicate review
- attendance processing open/finalize/reopen transitions
- administrator invitation lifecycle
- acknowledgment publication and acceptance
- confirmation-token issuance/revocation/expiry events

## Relationship summary

```text
Participant 1 ── * RegistrationGroup
Participant 1 ── * Registration
Event       1 ── * Registration
RegistrationGroup 1 ── * Registration
Registration 1 ── 0..1 Attendance
Event       1 ── * EventCancellationRequest
Event       1 ── * EventCancellation
Event       1 ── * ParticipantNotificationTask
ParticipantNotificationTask 1 ── * ParticipantNotificationDelivery
ParticipantNotificationDelivery 1 ── * NotificationDeliveryTransition
Event       * ── * Organization (eligible affiliations)

Organization 1 ── * Event (host)
Venue        1 ── * Event
Organization 1 ── * Participant (primary affiliation, optional)

AdminUser * ── * Organization
Participant 1 ── * FollowUpTask
Event       1 ── * FollowUpTask
Participant 1 ── * ParticipantNotificationTask
Participant 1 ── * AcknowledgmentAcceptance
Participant 1 ── * PossibleDuplicateCase
Participant 1 ── * ParticipantMerge (survivor or archived duplicate)
Event       1 ── * AcknowledgmentAcceptance (through RegistrationGroup)
AdminUser   1 ── * AdminInvitation
AdminInvitation * ── * Organization (invitation assignments)
AdminInvitation 0..1 ── 1 AdminUser (accepted Auth user)
AcknowledgmentVersion 1 ── * AcknowledgmentAcceptance
Registration 1 ── 0..1 OverCapacityOverride
Attendance 1 ── * AttendanceTransition
Event       0..1 ── 1 replacement Event (published replacement reference)
EventCancellation * ── 1 CancellationTemplateVersion
Event       1 ── * CompletedEventInvalidation
```

## Post-MVP Phase 7 additions

These are planned additive changes after migration `0019`; they do not rewrite the frozen Phase 1–6 model:

- Event publication metadata: `publication_status` (`DRAFT`, `PUBLISHED`, `UNPUBLISHED`), `public_slug`, `registration_opens_at`, `registration_closes_at`, `registration_paused_at`, `last_published_at`, and publication actor/audit references. Existing cancellation and event status remain authoritative.
- Public event lookup: a narrow server/database projection keyed by `public_slug`, returning only approved event, host, venue, local time, instructions, capacity/availability, and legal/registration state.
- Invitation lifecycle: the existing invitation model is extended/documented for one-time URL regeneration, expiration, revocation, raw-token non-persistence, and acceptance idempotency. Organization assignments remain invitation-authoritative.
- Event Series is introduced by the approved DEC-049 extension. The supported MVP-like recurrence
  surface is weekly materialized occurrences with one canonical series link and a rolling 14-day
  public selection window; arbitrary recurrence rules and recurrence editing remain deferred.
# DEC-051 addition

`participant_remembered_devices` stores only a participant relationship, SHA-256 token hash, lifecycle timestamps, revocation/replacement metadata, and a safe label. Raw tokens are never persisted, logged, or exposed through anonymous table access.
