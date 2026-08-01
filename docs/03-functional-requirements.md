# 03 — Functional Requirements

Priority values:
- MUST — MVP
- SHOULD — Phase 2
- COULD — Future

## Event management

### Approved pilot UX extension — DEC-051

Participants may optionally remember a browser after a successful booking. The remembered device is a convenience identifier only: it may prefill/streamline a booking, but the system revalidates the participant and all authoritative booking rules at submission. Required acknowledgments remain required for every booking. No participant account, device fingerprinting, SMS, or participant history access is introduced.

### Approved pilot extensions — DEC-049 and DEC-050

The following controlled extensions are approved for the local pilot and remain
within the existing event/registration model:

- A System Admin may create a weekly Event Series through an inclusive end date.
  Each occurrence is a separate Event with independent capacity, deadlines,
  registration, attendance, cancellation, and audit history. The canonical
  series link resolves to the next occurrence and permits selecting only
  published occurrences within the rolling 14-day window. Recurrence schedules
  are immutable after creation.
- An Event may store one HTTPS communication URL and participant-facing label.
  The link is returned only on a successful confirmation page; it is omitted
  from public pre-registration pages and failed confirmation results.
- Public branding is sourced from centralized typed configuration and replaceable
  static assets. It does not introduce an upload CMS, automated messaging,
  participant accounts, or group creation.

These extensions do not authorize production registration while the
Participation acknowledgment remains provisional.

### FR-001 — Create event
**User:** System Admin  
**Requirement:** Create a bookable event with name, host organization, venue, date, start time, end time, capacity, registration deadline interpreted in the Event timezone, status, description, and participant instructions. The Event timezone is inherited from the Venue and may be overridden by System Admin.  
**Acceptance criteria:**
- Required fields are validated.
- Capacity is a positive integer.
- End time is after start time.
- Saved event appears in admin event list.
- Open events receive a public URL.  
**Priority:** MUST

### FR-002 — Event statuses
Statuses: Draft, Open, Closed, Completed, Cancelled. Event visibility is either Public or Affiliation Restricted. A restricted event may identify one or more eligible organizations.  
**Acceptance criteria:**
- Only Open events accept public registrations.
- Public events are available to all eligible public registrants; Affiliation Restricted events are available only when the participant selects or provides an eligible organization.
- Restricted-event eligibility is evaluated for every selected event independently.
- Invitation codes and formal membership verification are not required in MVP.
- Cancelled and Closed events reject new public registrations.
- Completed and Cancelled events preserve history.  
**Priority:** MUST

### FR-003 — Copy event
Copy event configuration without copying registrations or attendance.  
**Priority:** MUST

### FR-004 — Capacity management
Enforce active registration count against event capacity. Cancelled registrations do not consume capacity.  
**Priority:** MUST

### FR-005 — Capacity reduction validation
Do not save a new capacity below the event's active registration count. Show the active registration count and validation error; never silently cancel registrants.  
**Priority:** MUST

## Public registration

### FR-006 — Public event schedule
Display open upcoming events with host, venue, date/time, and availability.  
**Priority:** MUST

### FR-007 — Multi-date selection
Participant can select one or more open event dates in one submission.  
**Acceptance criteria:**
- At least one event must be selected.
- Participant information is collected once.
- Events may belong to different hosts or venues.  
**Priority:** MUST

### FR-008 — Participant information
Collect:
- first name, required
- last name, required
- mobile phone, required
- email, optional for MVP
- primary affiliation or Other/No affiliation, required
- fitness experience, optional
- optional note to coach
- separate Participation acknowledgment, required
- separate Data Use acknowledgment, required

Participation acknowledgment text (provisional; requires legal review before production launch):

> I understand that participation in physical exercise involves inherent risks. I confirm that I am choosing to participate voluntarily and will follow the coach’s safety instructions, work within my abilities, and stop if I experience pain, dizziness, or unusual discomfort.

Data Use acknowledgment text:

> I agree that the information I provide may be used to manage my registration, attendance, event communication, and relevant follow-up.
**Priority:** MUST

### FR-009 — Independent event validation
Validate status, deadline, capacity, and duplicates independently for every selected event.  
**Priority:** MUST

### FR-010 — Partial success
One failed event must not invalidate successful registrations for other selected events.  
**Priority:** MUST

### FR-011 — Registration group
Create one Registration Group for a multi-date submission and one Registration for each successful event.  
**Priority:** MUST

### FR-012 — Duplicate active registration prevention
Prevent the same participant from having more than one active registration for the same event.  
**Priority:** MUST

### FR-013 — Registration confirmation
Display successful and unsuccessful event selections with reasons through a read-only opaque confirmation token scoped to the Registration Group. The token expires after 24 hours, works without email delivery, and exposes no participant history.  
**Priority:** MUST

### FR-014 — Calendar export
For each successful registration provide:
- Add to Google Calendar
- Download `.ics`
- Download all successful events as one `.ics`  
Calendar data includes event name, date, start/end, venue name/address, instructions, and the Event IANA timezone.  
**Priority:** MUST

### FR-015 — Participant cancellation
System Admin or authorized Host Admin can mark an event registration Cancelled. Host Admin authority is limited to assigned events.  
Participant self-cancellation is Phase 2.  
**Priority:** MUST

### FR-016 — Manual registration
Authorized System Admin or Host Admin assigned to the event can match/create a participant and add a registration, with duplicate and capacity warnings.  
**Priority:** MUST

### FR-017 — Add walk-in
Authorized System Admin or Host Admin assigned to the event can match/create a participant, register them for the event, and mark attendance. Host Admin is blocked when the event is full. System Admin may use an explicit over-capacity override requiring warning, reason, confirmation, identity, timestamp, and capacity/result counts; the published capacity does not change.  
**Priority:** MUST

## Attendance

### FR-018 — Event roster
Display participant name, phone, provided email where authorized, affiliation, registration time/status, attendance status, first-time-with-coach indicator, first-time-at-host indicator, and attendance count appropriate to role. Host Admin views contain only event-relevant data and host-scoped history.  
**Priority:** MUST

### FR-019 — One-action check-in
Mark a participant Attended with one primary action while attendance processing is OPEN. Attendance processing states are NOT_STARTED, OPEN, FINALIZED, and REOPENED. Authorized admins may open and finalize attendance for authorized events.  
**Priority:** MUST

### FR-020 — Finalize attendance
After confirmation, remaining active unchecked registrations become No-Show, checked-in registrations remain Attended, participant-cancelled registrations remain preserved, actor/time are recorded, and follow-up triggers run idempotently. Re-finalization creates no duplicate tasks.  
**Priority:** MUST

### FR-021 — Correct attendance
Authorized System Admin or Host Admin assigned to the event can correct an individual attendance after finalization with a reason and audit metadata. Only System Admin may reopen the entire finalized event; reopening requires a reason/audit record, preserves statuses until corrected, and requires re-finalization with safe trigger reassessment. Corrections reassess related follow-up tasks.  
**Priority:** MUST

## Participant CRM

### FR-022 — Persistent participant profile
Maintain one participant profile across venues.  
**Priority:** MUST

### FR-023 — Global participant history
System Admin sees all authorized registration and attendance history.  
**Priority:** MUST

### FR-024 — Scoped host participant view
Host Admin sees participant information only in relation to assigned organizations' events.  
**Priority:** MUST

### FR-025 — First-time indicators
Calculate:
- First time with coach: zero prior ATTENDED records for Events starting before the current Event.
- First time at host: zero prior ATTENDED records at Events hosted by the current Host Organization before the current Event.
- Returning: at least one prior ATTENDED record before the current Event.
- Events with identical start timestamps are not prior to one another.
- The current Event does not count as its own prior history; it becomes history only after attendance is finalized.
- Registration, cancellation, and No-Show do not establish returning status.  
**Priority:** MUST

### FR-026 — Participant notes
System Admin can maintain operational notes. Host access to notes is denied by default.  
**Priority:** MUST

### FR-027 — Participant search
System Admin searches by normalized name, normalized E.164 phone, or normalized email. Email is case-insensitive for comparison but is not an automatic merge key.  
**Priority:** MUST

## Organizations, venues, and access

### FR-028 — Organization records
Maintain reusable host/affiliation organizations with controlled names.  
**Priority:** MUST

### FR-029 — Venue records
Maintain reusable physical venues, optionally associated with an organization.  
**Priority:** MUST

### FR-030 — Participant affiliation
Participant has a current primary affiliation; each Registration stores affiliation at the time of registration.  
**Priority:** MUST

### FR-031 — Host Admin assignment
System Admin assigns Host Admins to one or more organizations.  
**Priority:** MUST

### FR-032 — Scoped host dashboard
Host Admin dashboard only includes assigned organizations and their events.  
**Priority:** MUST

### FR-033 — Server-side authorization
Unauthorized direct URL/API/database access must be denied.  
**Priority:** MUST

## Follow-up

### FR-034 — Follow-up task
Fields:
- participant
- related event
- reason
- trigger
- due date/time
- status
- suggested message
- created/completed timestamps
- notes  
Automated task triggers include First Attendance and Finalized No-Show. A no-show task is pending when created.  
Statuses: Pending, Completed, Dismissed.  
**Priority:** MUST

### FR-035 — First-attendance trigger
Create exactly one follow-up task when a participant completes their first-ever attendance. Due 24 hours after event end.  
**Priority:** MUST

### FR-036 — Suggested message
Coach can view, edit, and copy the suggested message.  
**Priority:** MUST

### FR-037 — Task completion
Only System Admin can view, edit, copy, complete, or dismiss participant follow-up tasks; completed tasks remain in history. Host Admin may see only event-operational cancellation-notification status without access to the global CRM follow-up record.  
**Priority:** MUST

### FR-038 — No-show follow-up
Create exactly one pending no-show follow-up task when a registration is finalized as No-Show. The task is reassessed when attendance is corrected. Messages are manually copied and sent; the system does not send them automatically.  
**Priority:** MUST

## Dashboard and exports

### FR-039 — System dashboard
Display next event, registration/capacity, available spots, first time with coach, first time at host, upcoming events, and follow-ups due.  
**Priority:** MUST

### FR-040 — Host dashboard
Display assigned organization's upcoming events, roster counts, available spots, and location-specific attendance summary.  
**Priority:** MUST

### FR-041 — CSV export
Export an authorized event roster and System Admin participant list. Host Admin exports are limited to assigned events and may include only participant name, phone, provided email, affiliation, registration status, and attendance status. Host exports must exclude global history, coach notes, follow-up history, and activity at other organizations.  
**Priority:** MUST

## Authentication and administration

### FR-042 — Admin authentication
System and Host Admin access requires authentication.  
**Priority:** MUST

### FR-043 — User roles
Support SYSTEM_ADMIN and HOST_ADMIN. Public administrator signup is prohibited. System Admin invites Host Admins by required email and assigns organizations before activation. Invitation status and lifecycle are recorded.  
**Priority:** MUST

### FR-044 — Archive records
Prefer archive/deactivate over destructive deletion for participants, organizations, venues, and events with history.  
**Priority:** MUST

## Event cancellation

### FR-045 — Event cancellation authorization and request
Only System Admin may directly cancel an event in MVP. Host Admin may submit a cancellation request only for an event hosted by an assigned organization; submitting a request does not cancel the event. A cancellation requires a reason, cancellation type (`PERMANENT`, `RESCHEDULING_PLANNED`, or `REPLACEMENT_DATE_TO_BE_ANNOUNCED`), and explicit confirmation.
**Priority:** MUST

### FR-046 — Event cancellation effects and audit
When System Admin confirms cancellation, the system must immediately prevent new registrations, preserve the event and registration history, disable check-in and attendance finalization, prevent affected registrations from becoming No-Show, and create exactly one participant-notification task per affected participant. Active affected registrations become Cancelled with an explicit `EVENT_CANCELLED` outcome. The event cancellation records who cancelled, when, why, type, and the number of active registrations affected. `EVENT_CANCELLED` is distinct from participant-cancelled registrations, and event cancellation does not count negatively against participants.
**Priority:** MUST

### FR-047 — Permanent cancellation and rescheduling
Cancelled Events cannot be restored in MVP and remain permanently Cancelled. `EVENT_CANCELLED` outcomes and history remain historical; registration and attendance do not reopen. For rescheduling, System Admin copies the cancelled Event into a new Draft Event, assigns the new date/time, opens registration, and invites affected participants to register; registrations and attendance are not automatically transferred.
**Priority:** MUST

## WhatsApp event groups

### FR-048 — Event WhatsApp invitation link
System Admin may optionally store a WhatsApp group invitation link on an event. MVP must not automatically add participants to a group. Direct WhatsApp Groups API integration is Phase 2; future integration must use an invite-based workflow.
**Priority:** MUST

### FR-049 — WhatsApp opt-in and disclosure
Registered participants may optionally opt in to receive the event's WhatsApp invitation link. Registration must disclose that joining a WhatsApp group can expose the participant's WhatsApp profile name and phone number to other group members. The event roster displays WhatsApp invitation opt-in and invitation-sent status. Registration remains valid without joining or opting in.
**Priority:** MUST

### FR-050 — WhatsApp export and invitation message
Authorized administrators may export only opted-in participants for an authorized event. Host Admin exports are limited to assigned events. The system provides copyable invitation-message text and does not send invitations automatically.
**Priority:** MUST

## Participant identity and administrator lifecycle

### FR-051 — Conservative participant matching
Normalize participant first name, last name, phone, and email. Automatically match an existing Participant only when normalized E.164 phone, normalized first name, and normalized last name all match. Phone-only, email-only, name-only, and conflicting matches must not automatically merge. Ambiguous matches create or identify a possible-duplicate case for System Admin review. Shared household contact information must not overwrite records.
**Priority:** MUST

### FR-052 — System Admin participant merge
Only System Admin may manually merge Participants. A merge designates one survivor, migrates registrations, attendance, follow-ups, notes, and history, preserves audit information, prevents duplicate active registrations, and archives the duplicate record. Host Admin cannot merge Participants.
**Priority:** MUST

### FR-053 — Phone and email normalization
Use a recognized libphonenumber-compatible parser. Default phone country is United States (+1), with another country selectable in the form. Store original/display phone, E.164 normalized phone, and detected/selected country. Normalize email by trimming whitespace, lowercasing for comparison, and basic format validation; do not remove Gmail periods, plus-address tags, or apply provider-specific transformations. Participant email is optional; administrator email is required.
**Priority:** MUST

### FR-054 — Indicator timing
Calculate indicators relative to the current Event's start timestamp. Two Events with identical start timestamps are not prior to one another. After current attendance is finalized, it becomes history for later Events.
**Priority:** MUST

### FR-055 — Follow-up authorization
Only System Admin may view, edit, copy, complete, or dismiss participant follow-up tasks or global follow-up history. Authorized Host Admin may see only event-operational cancellation-notification status.
**Priority:** MUST

### FR-056 — Walk-in over-capacity override
Block Host Admin walk-ins when an Event is full. Permit System Admin to use an explicit Over-Capacity Override only after warning, reason, confirmation, and recording administrator identity, timestamp, capacity, and resulting registration count. The override does not increase published capacity.
**Priority:** MUST

### FR-057 — Attendance processing lifecycle
Support NOT_STARTED, OPEN, FINALIZED, and REOPENED attendance processing states. System Admin and assigned Host Admin may open/finalize authorized events and correct individual attendance with reason/audit history. Only System Admin may reopen the entire finalized event; reopening requires re-finalization and idempotent trigger reassessment.
**Priority:** MUST

### FR-058 — Timezone and DST handling
Store event instants as timezone-aware timestamps normalized to UTC and store the Event IANA timezone separately. Event inherits Venue timezone with System Admin override. Use Event timezone for public/admin display, registration deadlines, and calendar exports. Venue timezone changes do not retroactively change existing Events. Default initial Venue timezone is America/New_York. Follow-up due times derive from the stored Event end instant.
**Priority:** MUST

### FR-059 — Administrator invitation and provisioning
Prohibit public administrator signup. Securely provision the initial System Admin during deployment. System Admin invites Host Admins using required email and assigns Organizations before activation. Invitation status starts PENDING; tokens are cryptographically random, single-use, hashed at rest, expire after 72 hours, and are invalidated on acceptance, revocation, or replacement. System Admin may resend, revoke, suspend, reactivate, and change assignments. No default production passwords exist.
**Priority:** MUST

### FR-060 — Versioned acknowledgments
Acknowledgment text is immutable after publication; every change creates a version. Store type, version, exact text, content hash, effective/retired timestamps, and legal status. Record each acceptance with Participant, Registration Group, exact version, timestamp, acceptance method, IP address, and user agent. Supported types include PARTICIPATION_RISK, DATA_USE, and WHATSAPP_DISCLOSURE. Historical acceptances resolve to the exact accepted text.
**Priority:** MUST

### FR-061 — Registration confirmation token
Generate an opaque token with at least 256 bits of cryptographically secure randomness. Store only its SHA-256 hash, scope it to one Registration Group, make it read-only, and expire it after 24 hours. It must not encode PII or sequential IDs, must work immediately without email delivery, and permits only that submission's results and calendar links; it is not participant authentication.
**Priority:** MUST

### FR-062 — Legal approval gate
The Participation acknowledgment remains PROVISIONAL. Legal review and an approved acknowledgment version are production-launch blockers. Development/testing may use provisional wording, but production deployment must be blocked until an approved version exists.
**Priority:** MUST

### FR-063 — Cancellation notification timing and templates
Create participant-notification tasks immediately when an Event is cancelled. Set `created_at` and `due_at` to the cancellation timestamp, priority to HIGH, and display Event start time and time remaining. Provide editable default templates for Permanent cancellation, Replacement Date to Be Announced, and Replacement Event Available:

- Permanent cancellation: “Hi [First Name], the [Event Name] scheduled for [Date and Time] at [Venue] has been cancelled. We apologize for the inconvenience. [Optional Next Steps]”
- Replacement date to be announced: “Hi [First Name], the [Event Name] scheduled for [Date and Time] at [Venue] has been cancelled. We plan to announce a replacement date soon and will share an update when available.”
- Replacement Event available: “Hi [First Name], the [Event Name] scheduled for [Original Date and Time] has been cancelled. A replacement event is available on [New Date and Time]. You can register here: [Registration Link]”

Templates are editable operational text and are never automatically sent.
**Priority:** MUST

### FR-064 — Cancellation notification permissions and delivery tracking
Only System Admin may complete or dismiss the overall cancellation participant-notification task. Authorized Host Admins may update individual affected Registration notification statuses for assigned Events but may not close the overall task. The overall task is complete only after System Admin confirmation.

Track per affected Registration:
- status: NOT_REQUIRED, PENDING, SENT, FAILED, or DECLINED
- channel: WHATSAPP, SMS, EMAIL, PHONE, or OTHER
- sent_at
- sent_by_admin_id
- delivery_note

`SENT` means an administrator manually recorded that a message was sent; it does not claim delivery or read status.
**Priority:** MUST

### FR-065 — Cancellation request workflow
Cancellation Request statuses are PENDING, APPROVED, REJECTED, and WITHDRAWN. An assigned Host Admin may submit and withdraw a request while PENDING. Only System Admin may approve or reject; rejection requires a reason. Only APPROVED triggers cancellation. Store requester, requested time, reason, urgency, proposed replacement date, reviewer, review time/decision/reason, and withdrawal actor/time. Approved, rejected, and withdrawn decisions remain in audit history, and a new request may be submitted later.
**Priority:** MUST

### FR-066 — WhatsApp export specification
The WhatsApp opt-in export includes only Event Name, Event Date, Participant First Name, Participant Last Name, Display Phone, E.164 Phone, Email, Primary Affiliation, WhatsApp Opt-In, Invitation Status, Invitation Sent At, and Registration Status. Exclude coach notes, global attendance history, no-show history, follow-up history, other-organization activity, fitness experience, acknowledgment audit data, IP addresses, and internal identifiers. By default include only the selected authorized Event, opted-in Participants, and active Registrations; cancelled/EVENT_CANCELLED Registrations require an explicit admin filter.
**Priority:** MUST

### FR-067 — WhatsApp invitation sent workflow
The Event roster is authoritative for WhatsApp invitation status. Admin filters to opted-in Registrations, copies invitation text or exports the list, explicitly selects Registrations, and clicks Mark Invitation Sent. This records SENT, timestamp, administrator, and channel WHATSAPP. Support resetting to PENDING and marking FAILED with an optional note. Copying or exporting never marks SENT automatically.
**Priority:** MUST

### FR-068 — Per-Registration WhatsApp opt-in
Store WhatsApp opt-in per Registration with `whatsapp_opt_in`, `whatsapp_opt_in_at`, and `whatsapp_disclosure_version_id`. A Participant may opt in for one Event and decline another; Event opt-in is not permanent participant-level consent.
**Priority:** MUST

### FR-069 — Notification delivery state machine
Per-Registration cancellation-notification statuses support only these transitions: PENDING to SENT, FAILED, DECLINED, or NOT_REQUIRED; FAILED to SENT or PENDING; SENT to PENDING only by System Admin; and DECLINED to PENDING only after a new participant request. Every transition stores previous state, new state, actor, timestamp, channel, and optional note. Host Admins may update records only for authorized Events. Only System Admin may reset SENT, change DECLINED, mark NOT_REQUIRED, or complete/dismiss the overall task. Normal completion requires all affected active Registrations to be SENT, DECLINED, or NOT_REQUIRED. Complete With Exceptions requires a reason and retains unresolved recipients in the audit record.
**Priority:** MUST

### FR-070 — Cancellation notification task completion
PENDING and FAILED delivery records block normal completion of the overall cancellation-notification task. Complete With Exceptions is a separate System Admin action and must preserve the unresolved recipient states and reason in audit history.
**Priority:** MUST

### FR-071 — Versioned cancellation templates
Store immutable cancellation-template versions with type, version, exact text, status, created_at, created_by, and retired_at. Editing a published template creates a new version. Each Event cancellation stores the selected version, fully rendered message snapshot, and administrator edits. Historical rendered messages never change. Template types are PERMANENT_CANCELLATION, REPLACEMENT_DATE_PENDING, and REPLACEMENT_EVENT_AVAILABLE.
**Priority:** MUST

### FR-072 — Replacement-event link rendering
Replacement-event links may reference only a published replacement Event and must use its canonical public Event URL without exposing internal identifiers. Omit the link while the replacement Event is Draft.
**Priority:** MUST

### FR-073 — Cancellation-request cardinality and editing
Only one PENDING cancellation request may exist for an Event. A PENDING request may not be materially edited; the Host Admin must withdraw it and submit a replacement request. A new request is permitted after REJECTED or WITHDRAWN.
**Priority:** MUST

### FR-074 — Atomic cancellation approval
Cancellation approval must execute transactionally: lock Event and request, verify the Event is cancellable and request is PENDING, approve the request, cancel the Event, apply EVENT_CANCELLED outcomes, create notification records/task, and write audit records. Failure rolls back all steps. Repeated approval attempts do not duplicate cancellation records, outcomes, or tasks.
**Priority:** MUST

### FR-075 — Participant merge conflict resolution
Only System Admin may merge Participants and must select the survivor. Contact conflicts require an explicit retained phone/email choice; conflicting valid values may remain secondary or historical. Preserve all affiliations while selecting the primary affiliation. For duplicate same-Event registrations, retain one valid active record and archive the duplicate as MERGED_DUPLICATE. Preserve all acknowledgment acceptances unchanged; reassign notes, follow-ups, registration history, and attendance history; archive the source Participant.
**Priority:** MUST

### FR-076 — Attendance conflict resolution during merge
During Participant merge, ATTENDED takes precedence over NO_SHOW unless the administrator explicitly selects another resolution. Every attendance conflict resolution requires a reason. MVP merges are irreversible and fully auditable.
**Priority:** MUST

### FR-077 — Administrator invitation acceptance
Invitation acceptance verifies the invited email, creates or confirms the Supabase Auth user, requires normalized email equality, links the Auth user to the pending admin profile, activates the assigned organizations, and then marks the invitation ACCEPTED and profile ACTIVE. Invitees cannot change assignments. A Host Admin with no active organization assignments is suspended.
**Priority:** MUST

### FR-078 — Transactional administrator activation
Administrator invitation acceptance is atomic. An ACTIVE Host Admin must never exist without the intended active organization assignments.
**Priority:** MUST

### FR-079 — Acknowledgment legal-status lifecycle
Acknowledgment versions support DRAFT, PROVISIONAL, APPROVED, RETIRED, and REVOKED. Allowed transitions are DRAFT→PROVISIONAL/APPROVED, PROVISIONAL→APPROVED/RETIRED, and APPROVED→RETIRED/REVOKED. Only APPROVED versions may be used in production; PROVISIONAL versions are development/testing-only; RETIRED and REVOKED versions cannot be used for new registrations.
**Priority:** MUST

### FR-080 — Immutable acknowledgment evidence
Historical acknowledgment evidence retains exact text/version/hash, participant, Registration Group, timestamp, IP, user agent, and acceptance method. Ordinary administrators cannot delete or alter it because a version is retired or revoked.
**Priority:** MUST

### FR-081 — Confirmation-token lifecycle
Only one active confirmation token may exist per Registration Group. Regeneration immediately revokes the prior token. Store token hash, issued_at, expires_at, revoked_at, last_accessed_at, and access_count. Valid tokens are read-only and reusable during validity for the same confirmation page only.
**Priority:** MUST

### FR-082 — Confirmation-token abuse controls
Confirmation tokens cannot authenticate Participants, modify/cancel registrations, edit participant data, or access history. After expiration or revocation, return a generic invalid-link response. Apply configurable defaults of 10 validation attempts per IP per 10 minutes and 3 regenerations per Registration Group per hour, and log repeated invalid attempts.
**Priority:** MUST

### FR-083 — DST-invalid and duplicated local times
Reject nonexistent spring-forward local times with an explanation. For duplicated fall-back times, require first/second occurrence selection. Store the resulting UTC instant and IANA timezone. Public displays must be unambiguous and include a timezone abbreviation or offset where needed.
**Priority:** MUST

### FR-084 — Over-Capacity Override record
Create an immutable Over-Capacity Override linked to the Event and resulting Registration, storing approving System Admin, reason, capacity and active-registration counts before/after, timestamp, and source WALK_IN, ADMIN_REGISTRATION, or OTHER. Event capacity does not change, and cancelling the Registration does not delete the override.
**Priority:** MUST

### FR-085 — Attendance transition history and cancellation before attendance
Create an immutable attendance-transition record for every attendance change. Cancellation before attendance opens creates no attendance records. Cancellation while attendance is OPEN requires System Admin confirmation, preserves check-in history, marks checked-in Participants EXCUSED or the approved equivalent, marks unchecked active Registrations EVENT_CANCELLED, and creates no No-Show outcomes.
**Priority:** MUST

### FR-086 — Cancellation after finalized attendance
Cancellation after attendance is FINALIZED is blocked through the standard cancellation action. An exceptional Invalidate Completed Event action requires System Admin authorization, a reason, confirmation, and audit; it preserves finalized attendance history and transition records and never silently rewrites completed outcomes.
**Priority:** MUST

## Post-MVP Phase 7 — Publishing, Links, QR Distribution, and Invitations

The following requirements are approved by DEC-047 as a post-MVP extension. They are not part of the original frozen MVP and are not implemented by this documentation change.

### FR-087 — Event publication
Authorized administrators can publish an eligible event and unpublish a previously published event. Draft and unpublished events are not publicly registrable. Publication cannot bypass capacity, registration windows, cancellation, organization/venue state, or the legal gate. **Priority:** MUST — Phase 7

### FR-088 — Stable public event slug
Each published event has a bounded, lowercase, URL-safe, collision-safe public slug that contains no participant data or sequential private identifier. Slug lookup is server-side and publication/availability checks remain authoritative. **Priority:** MUST — Phase 7

### FR-089 — Canonical public registration URL
Published events expose a canonical participant URL using the configured application base URL and public slug, such as `/register/{public-slug}`. Canonical URLs do not trust user-supplied Host headers and do not contain authentication or participant tokens. **Priority:** MUST — Phase 7

### FR-090 — Registration availability controls
Authorized administrators can configure registration opening and closing times and pause or resume registration. Availability is evaluated with server/database time and distinguishes not-yet-open, open, paused, closed, full, cancelled, unpublished, unavailable, and legally blocked states. **Priority:** MUST — Phase 7

### FR-091 — Public availability enforcement
Public event lookup and registration enforce publication, availability, capacity, event cancellation, organization/venue state, and legal readiness at the server and database/RPC layers. The public UI is not the sole enforcement boundary and raw database errors are not exposed. **Priority:** MUST — Phase 7

### FR-092 — Link management
Authorized administrators can view publication and registration state, preview the public page, and copy the complete canonical URL. Copying or previewing never publishes an event or creates a registration. **Priority:** MUST — Phase 7

### FR-093 — QR distribution
Authorized administrators can generate a high-contrast, accessible PNG or SVG QR code whose exact payload is the canonical public URL. QR generation does not publish an event and includes no private ID, participant data, administrator token, tracking parameter, or analytics destination. **Priority:** MUST — Phase 7

### FR-094 — Canonical base URL and environments
Local may use a documented localhost fallback. Staging and production require an explicit valid HTTPS `APP_BASE_URL`; trailing slashes are normalized, and missing or invalid configuration fails safely. Environment behavior must clearly identify non-production staging and keep production registration blocked unless explicitly legally ready. **Priority:** MUST — Phase 7

### FR-095 — System Admin invitation links
System Admin can create a one-time administrator invitation link for an intended email, approved role, and required organization assignments. The application does not send the invitation automatically; it displays the raw link only at creation/regeneration time for private distribution. **Priority:** MUST — Phase 7

### FR-096 — Invitation token security
Invitation tokens are high-entropy and single-use. Only a cryptographic hash is stored server-side; raw tokens are never retained in reusable fields, logs, analytics, browser bundles, or audit payloads. **Priority:** MUST — Phase 7

### FR-097 — Invitation lifecycle
Invitations expire, can be revoked while pending, and can be regenerated so the prior pending token becomes unusable. Invalid, expired, revoked, replaced, accepted, and malformed tokens receive safe non-enumerating responses. **Priority:** MUST — Phase 7

### FR-098 — Invitation acceptance and assignment
Acceptance verifies the invited identity, creates or links the authenticated administrator profile, and transactionally applies only the invited role and organization assignments. Invitees cannot alter assignments; an active Host Admin cannot exist without active intended assignments. **Priority:** MUST — Phase 7

### FR-099 — Existing-account and concurrency safety
Existing Auth accounts are linked only after authenticated identity verification. Repeated or concurrent acceptance produces at most one administrator profile and one set of assignments, with no partial privilege. **Priority:** MUST — Phase 7

### FR-100 — Publication authorization
System Admin may publish, unpublish, pause, resume, edit approved slugs, copy links, preview pages, and generate QR codes for any eligible event. Host Admin publication authority, if enabled by the synchronized implementation design, is limited to assigned organizations and never changes environment or legal readiness. **Priority:** MUST — Phase 7

### FR-101 — Cross-organization isolation
Authenticated management queries and mutations for publication, slugs, links, QR generation, and invitations enforce organization scope and deny unassigned Host Admins, inactive administrators, non-admins, and anonymous users without leaking data. **Priority:** MUST — Phase 7

### FR-102 — Public privacy
Public routes return only approved registration-page information and never expose unpublished event data, internal IDs, administrator identity/contact data, participant data, invitation tokens, operational notes, or raw database errors. **Priority:** MUST — Phase 7

### FR-103 — Auditability
Publish, unpublish, pause, resume, slug changes, invitation creation, revocation, regeneration, and acceptance record actor, timestamp, subject, organization, and relevant prior/new state without storing raw tokens. **Priority:** MUST — Phase 7

### FR-104 — Legal gate behavior
Synthetic local registration remains permitted. Staging is non-production and restricted as configured. Production participant registration is denied before participant data submission while the Participation acknowledgment is provisional, and the gate is enforced in UI, server actions, and database/RPC paths. **Priority:** MUST — Phase 7

### FR-105 — Explicit Phase 7 boundaries
Phase 7 does not include automated email/SMS/WhatsApp, push notifications, participant accounts or login, participant merging, analytics dashboards, tracking links or QR analytics, payments, production deployment, legal approval, or Phase 8 work. **Priority:** MUST — Phase 7

### DEC-052 presentation addendum
Administrator list pages may expose existing create/invite workflows through URL-backed segmented navigation. Events may present existing event data as local-image cards and a scoped quick roster. The Participants page retains search/profile access only; no manual participant-creation workflow is added.
