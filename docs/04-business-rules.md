# 04 — Business Rules

## Registration
- BR-001: One participant may have only one active registration per event.
- BR-002: A participant may select multiple events in one submission.
- BR-003: Every successful event selection creates an independent Registration.
- BR-004: Registration Group represents the submission transaction, not the reservation itself.
- BR-005: Capacity is checked at final write time, not only when the page loads.
- BR-006: Partial success is required.
- BR-007: Cancelled registrations do not consume capacity.
- BR-008: Draft, Closed, Completed, and Cancelled events reject public registration; only Open events can accept registration.
- BR-009: Admin may register a participant after the public deadline if authorized.
- BR-010: Incomplete or invalid forms do not consume capacity.
- BR-011: Repeat submission/double-click must not create duplicate active registrations.

## Participant identity
- BR-012: Participant identity is global across organizations and venues.
- BR-013: Phone numbers are normalized for matching.
- BR-014: Duplicate detection is conservative; shared household contact details must not trigger automatic merging.
- BR-015: Participant primary affiliation may differ from the event host.
- BR-016: Registration stores affiliation at registration time.
- BR-017: Changing current affiliation does not rewrite historical registrations.

## Organizations and venues
- BR-018: Host Organization controls host administrative access.
- BR-019: Venue is the physical location and may differ from Host Organization.
- BR-020: Public registration does not create unrestricted organization records; use approved values plus Other/No affiliation.
- BR-021: A participant may attend an event hosted by any organization unless an Open event is Affiliation Restricted to one or more eligible organizations. Invitation codes and formal membership verification are outside MVP.

## Attendance
- BR-022: Registration status and attendance status are separate concepts.
- BR-023: Registration statuses are Registered and Cancelled.
- BR-024: Attendance outcome statuses are NOT_RECORDED, ATTENDED, NO_SHOW, and EXCUSED. Event processing states are separate: NOT_STARTED, OPEN, FINALIZED, and REOPENED.
- BR-025: A Cancelled registration cannot become No-Show.
- BR-026: Only active registrations can be finalized as No-Show.
- BR-027: Attendance finalization requires explicit confirmation; each active unchecked registration finalized as No-Show creates one pending no-show follow-up task.
- BR-028: Authorized corrections remain possible after finalization, with audit metadata and reassessment of any related no-show follow-up task.
- BR-029: Walk-ins must be attached to a participant and registration before attendance is recorded.

## Indicators
- BR-030: First time with coach means zero prior Attended records before the current event.
- BR-031: First time at host means zero prior Attended records for events hosted by that organization before the current event.
- BR-032: Returning means at least one prior Attended record globally.
- BR-033: Registrations, cancellations, and no-shows do not make a person returning.
- BR-034: Indicators are calculated, not manually edited.

## Follow-up
- BR-035: First attendance creates exactly one First Attendance task; finalized No-Show creates exactly one pending no-show task.
- BR-036: Trigger processing for First Attendance and finalized No-Show must be idempotent; each trigger creates at most one corresponding task.
- BR-037: Re-finalizing an event must not create duplicate tasks.
- BR-038: Overdue tasks remain visible until Completed or Dismissed.
- BR-039: MVP messages are copied and sent outside the system.
- BR-040: Correcting a No-Show to Attended must cause the system to reassess the related trigger-created no-show task; it must not remain incorrectly actionable as a no-show task.

## Authorization and privacy
- BR-041: System Admin has global product access.
- BR-042: Host Admin access is limited to assigned organizations.
- BR-043: Host Admin may not see unrelated event data through UI, API, exports, search, or direct URL.
- BR-044: Host Admin sees only event-relevant participant data and host-specific history.
- BR-045: Global participant history and global follow-up tasks are restricted to System Admin.
- BR-046: Public users cannot access rosters or participant data.
- BR-047: Authorization must be implemented at the server/data layer.
- BR-048: Minimum necessary personal data shall be collected.

## Historical integrity
- BR-049: Events with registrations are cancelled/archived rather than normally deleted.
- BR-050: Participant records with history are archived rather than normally deleted.
- BR-051: Capacity cannot be saved below active registrations; validation prevents the save and never automatically cancels people.
- BR-052: Calendar export is only offered for successfully created registrations.
- BR-053: Host Admins may manage registrations, walk-ins, check-in, attendance finalization, and attendance corrections only for assigned events; they may not edit core event details.
- BR-054: Host Admin roster exports are limited to authorized events and the approved event-operational participant fields; global history, coach notes, follow-up history, and other-organization activity are excluded.
- BR-055: Registration requires separate Participation and Data Use acknowledgments. The Participation wording is provisional and requires legal review before production launch.
- BR-056: Only System Admin may directly cancel an event in MVP; Host Admin may submit a cancellation request only for an assigned event's host organization. Cancelled Events cannot be restored in MVP.
- BR-057: Event cancellation requires a reason, cancellation type of Permanent, Rescheduling Planned, or Replacement Date to Be Announced, and explicit confirmation.
- BR-058: Confirmed event cancellation immediately rejects new registrations, preserves the event and registration history, disables check-in and attendance finalization, and creates participant-notification tasks.
- BR-059: Cancelled events never convert affected registrations to No-Show; affected active registrations become Cancelled with an explicit `EVENT_CANCELLED` outcome distinct from participant cancellation.
- BR-060: Event cancellation audit metadata records who, when, why, cancellation type, and the number of active registrations affected.
- BR-061: Event cancellation does not count negatively against a participant.
- BR-062: Cancelled Events remain permanently Cancelled; EVENT_CANCELLED outcomes and history remain historical, and registration/attendance do not reopen.
- BR-063: Rescheduling copies the cancelled original into a separate Draft Event, assigns the new date/time, opens registration, invites affected participants, and never automatically transfers registrations or attendance.
- BR-064: WhatsApp groups are optional; MVP never automatically adds participants to a group.
- BR-065: System Admin may store an event WhatsApp invitation link. Future integration uses an invite-based workflow; direct WhatsApp Groups API integration is Phase 2.
- BR-066: WhatsApp opt-in is optional, and registration must disclose that joining a group can expose the participant's WhatsApp profile name and phone number to other group members.
- BR-067: Event rosters display WhatsApp opt-in and invitation-sent status.
- BR-068: WhatsApp exports contain only opted-in participants for an authorized event; Host Admin exports remain assigned-event scoped.
- BR-069: Invitation-message text is copyable and manually sent; MVP does not automatically send invitations.
- BR-070: Normalize participant first name, last name, phone, and email before matching.
- BR-071: Automatic participant matching requires normalized E.164 phone plus normalized first and last name; no single-field or conflicting match may auto-merge.
- BR-072: Ambiguous matches become possible-duplicate cases for System Admin review; shared household contact information never overwrites records.
- BR-073: Only System Admin may manually merge Participants. The survivor receives migrated registrations, attendance, follow-ups, notes, and history; audit data is preserved, duplicate active registrations are prevented, and the duplicate is archived.
- BR-074: Phone normalization uses a libphonenumber-compatible parser, defaults to United States (+1), supports another selected country, and stores display/original phone, E.164 phone, and country. Email comparison trims/lowercases and validates format without Gmail/provider transformations; email is never an automatic merge key.
- BR-075: Participant email is optional; administrator email is required.
- BR-076: Indicators compare only prior ATTENDED records from Events starting before the current Event. Equal start timestamps are not prior; the current Event becomes history only after attendance finalization.
- BR-077: Only System Admin may access participant follow-up tasks or global follow-up history. Host Admin may see only event-operational cancellation-notification status.
- BR-078: Host Admin may not add a walk-in when an Event is full. System Admin may use an explicit Over-Capacity Override with warning, reason, confirmation, identity, timestamp, and capacity/result counts; published capacity is unchanged.
- BR-079: Attendance processing states are NOT_STARTED, OPEN, FINALIZED, and REOPENED. Authorized admins may open/finalize and correct individual attendance; only System Admin may reopen the entire finalized Event.
- BR-080: Reopening requires a reason and audit record, preserves existing statuses until corrected, requires re-finalization, and safely reassesses triggers without duplicate tasks.
- BR-081: Event instants are stored in UTC with a separate IANA Event timezone. Venue timezone is inherited unless System Admin overrides it; displays, deadlines, and calendar exports use Event timezone, and Venue timezone changes do not alter existing Events.
- BR-082: Public administrator signup is prohibited. System Admin invitations require email, organization assignment before activation, PENDING status, hashed single-use 72-hour tokens, and no production default passwords.
- BR-083: System Admin may resend, revoke, suspend, reactivate, and change administrator assignments; accepted invitations become ACTIVE and invalidated tokens cannot be reused.
- BR-084: Acknowledgment text is immutable by version. Each acceptance stores exact type/version/text resolution, content hash, effective/legal status, participant, registration group, timestamp, method, IP, and user agent.
- BR-085: Supported acknowledgment types include PARTICIPATION_RISK, DATA_USE, and WHATSAPP_DISCLOSURE. Historical acceptances always resolve to their exact accepted text.
- BR-086: Registration confirmation tokens are read-only, opaque, cryptographically random (at least 256 bits), SHA-256 hashed at rest, scoped to one Registration Group, expire after 24 hours, and reveal only that submission's results/calendar links.
- BR-087: Confirmation tokens are not participant authentication and cannot expose participant history; they work immediately without requiring email delivery.
- BR-088: The Participation acknowledgment remains PROVISIONAL; production deployment is blocked until legal review and an approved acknowledgment version exist.
- BR-089: Cancellation participant-notification tasks are created immediately at cancellation with created_at and due_at equal to cancellation time, HIGH priority, Event start time, and time remaining displayed.
- BR-090: Cancellation message templates are editable operational text for Permanent, Replacement Date to Be Announced, and Replacement Event Available; no template is automatically sent.
- BR-091: Only System Admin may complete/dismiss the overall cancellation notification task. Assigned Host Admin may update individual affected Registration notification statuses but cannot close the overall task.
- BR-092: Notification status is tracked per affected Registration as NOT_REQUIRED, PENDING, SENT, FAILED, or DECLINED, with channel WHATSAPP/SMS/EMAIL/PHONE/OTHER, sent_at, sent_by_admin_id, and delivery_note. SENT means manually recorded as sent, not delivered/read.
- BR-093: Cancellation Requests are PENDING, APPROVED, REJECTED, or WITHDRAWN. Assigned Host Admin may withdraw while PENDING; only System Admin approves/rejects; rejection requires a reason; only APPROVED cancels; all decisions remain audited.
- BR-094: WhatsApp opt-in exports include only the approved event/participant fields, selected authorized Event, opted-in Participants, and active Registrations by default. Cancelled/EVENT_CANCELLED rows require an explicit filter; prohibited history, notes, acknowledgment evidence, IPs, and identifiers are excluded.
- BR-095: The Event roster is authoritative for WhatsApp invitation status. Copy/export does not mark SENT; explicit selected-Registration Mark Invitation Sent records SENT, WHATSAPP, actor/time, and supports reset to PENDING or FAILED with note.
- BR-096: WhatsApp opt-in is stored per Registration with opt-in timestamp and disclosure version; consent for one Event does not carry to another.
- BR-097: Notification delivery transitions are PENDING→SENT/FAILED/DECLINED/NOT_REQUIRED, FAILED→SENT/PENDING, SENT→PENDING only by System Admin, and DECLINED→PENDING only after a new participant request. Every transition stores prior/new state, actor, timestamp, channel, and optional note.
- BR-098: Only System Admin may reset SENT, change DECLINED, mark NOT_REQUIRED, or complete/dismiss the overall cancellation-notification task. Normal completion requires every affected active Registration to be SENT, DECLINED, or NOT_REQUIRED; PENDING and FAILED block completion. Complete With Exceptions requires a reason and preserves unresolved recipients in audit history.
- BR-099: Cancellation templates are immutable versioned records. Editing a published template creates a new version, and each cancellation stores the selected version, rendered-message snapshot, and administrator edits. Replacement links reference only published replacement Events through canonical public URLs; Draft replacements have no link.
- BR-100: Only one PENDING cancellation request may exist per Event. Pending requests cannot be materially edited; they must be withdrawn and replaced. A new request may follow REJECTED or WITHDRAWN.
- BR-101: Cancellation approval locks the Event and request and atomically approves, cancels, applies EVENT_CANCELLED outcomes, creates notification records/task, and audits. Any failure rolls back all effects; repeated approval is idempotent.
- BR-102: Participant merges require a selected survivor and explicit conflict choices. Conflicting valid contacts may remain secondary/historical; affiliations are preserved with an administrator-selected primary. Same-Event duplicate registrations retain one active row and archive the duplicate as MERGED_DUPLICATE. Acknowledgments remain unchanged; notes, follow-ups, registrations, and attendance history move to the survivor; the source is archived.
- BR-103: ATTENDED takes precedence over NO_SHOW during merge unless System Admin explicitly chooses another resolution, and every conflict requires a reason. MVP merges are irreversible and audited.
- BR-104: Invitation acceptance verifies normalized email equality, creates/confirms Supabase Auth, links the Auth user to the pending admin profile, activates assigned organizations, and then accepts the invitation and activates the profile. Invitees cannot alter assignments; no active assignment means suspended Host access.
- BR-105: Invitation acceptance is atomic; an ACTIVE Host Admin cannot exist without intended active organization assignments.
- BR-106: Acknowledgment legal statuses are DRAFT, PROVISIONAL, APPROVED, RETIRED, and REVOKED with only the approved transitions. Only APPROVED is production-usable; PROVISIONAL is development/testing-only; RETIRED/REVOKED cannot be used for new registrations. Historical evidence is immutable and retained.
- BR-107: Only one active confirmation token exists per Registration Group. Regeneration revokes the previous token. Valid tokens are read-only and reusable only for the same confirmation page; expired/revoked tokens return a generic invalid-link response.
- BR-108: Confirmation-token endpoints enforce configurable defaults of 10 validation attempts per IP per 10 minutes and 3 regenerations per Registration Group per hour, and log repeated invalid attempts. Tokens cannot authenticate, mutate, or expose history.
- BR-109: Nonexistent spring-forward local times are rejected. Duplicated fall-back times require first/second occurrence selection. Store UTC plus IANA timezone and display an unambiguous local time with offset/abbreviation when needed.
- BR-110: Every Over-Capacity Override is immutable, identifies Event/Registration/System Admin/reason/counts/time/source, leaves published capacity unchanged, and survives Registration cancellation.
- BR-111: Every attendance change has an immutable transition record. Cancellation before attendance opens creates no attendance records; cancellation while OPEN preserves check-in history, uses EXCUSED or the documented equivalent for checked-in Participants, marks unchecked active Registrations EVENT_CANCELLED, and creates no No-Shows.
- BR-112: Cancellation after FINALIZED is blocked through the normal action. Exceptional invalidation requires System Admin, confirmation, reason, and audit, preserves finalized history and transitions, and never silently rewrites completed outcomes.
