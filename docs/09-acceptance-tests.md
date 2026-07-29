# 09 — Acceptance Tests

These are business-level tests. Codex should translate them into unit, integration, database-policy, and end-to-end tests as appropriate.

## AT-001 — Multi-date success
**Given** an open Event A and Event B both have capacity  
**When** John submits one registration selecting A and B  
**Then**
- one Participant is created or matched
- one Registration Group is created
- two Registrations are created
- both appear on confirmation

## AT-002 — Partial capacity success
**Given** Event A has capacity, Event B is full, Event C has capacity  
**When** John selects A, B, and C  
**Then**
- A succeeds
- B fails with Event Full
- C succeeds
- the successful registrations remain committed
- confirmation clearly displays all results

## AT-003 — Duplicate prevention
**Given** John has an active registration for Event A  
**When** John submits another registration for Event A  
**Then**
- no second active registration is created
- result says Already Registered

## AT-004 — Phone normalization
**Given** John exists with `(703) 555-1212`  
**When** a form uses `7035551212`  
**Then** the system treats the normalized phone values as equivalent for matching.

## AT-005 — Shared contact caution
**Given** two legitimate people share one household phone  
**When** the second person registers with a different name  
**Then** the system does not automatically overwrite or merge the first participant.

## AT-006 — Capacity race
**Given** one spot remains  
**When** two different participants submit concurrently  
**Then**
- no more than one new active registration is committed
- the other receives a Full result

## AT-007 — Cancellation frees capacity
**Given** Event A is full  
**When** one registration becomes Cancelled  
**Then** one spot becomes available.

## AT-008 — Capacity reduction
**Given** 19 active registrations and capacity 20  
**When** System Admin attempts to set capacity to 15  
**Then**
- a warning is shown
- no registrations are cancelled
- the capacity change is rejected
- the event remains at capacity 20

## AT-009 — Cross-location participation
**Given** John's primary affiliation is ABC Mosque  
**When** John registers for an XYZ-hosted event  
**Then**
- John remains one Participant
- Registration stores ABC affiliation
- Event stores XYZ as host

## AT-010 — First with coach
**Given** Sarah has zero prior Attended records  
**When** Sarah attends Event A  
**Then** Event A roster identifies her as First with Coach because the indicator excludes the current event and uses only prior finalized attendance.

## AT-011 — First at host
**Given** Sarah previously attended an ABC-hosted event but never an XYZ-hosted event  
**When** she registers for XYZ Event B  
**Then**
- she is Returning
- she is First at This Host for XYZ

## AT-012 — Registration is not attendance
**Given** Mark previously registered but never attended  
**When** he registers for a new event  
**Then** he remains First with Coach.

## AT-013 — Finalize attendance
**Given**
- John checked in
- Jane active and unchecked
- Mark cancelled  
**When** attendance is finalized and confirmed  
**Then**
- John is Attended
- Jane is No-Show
- Mark remains Cancelled

## AT-014 — Finalization confirmation
**Given** unchecked active registrations exist  
**When** admin selects Finalize  
**Then** the system displays a confirmation before changing them to No-Show.

## AT-015 — First attendance task
**Given** John has zero previous attendances  
**When** John's first attendance is finalized  
**Then**
- exactly one First Attendance task is created
- due time is event end plus 24 hours
- status is Pending

## AT-016 — Trigger idempotency
**Given** John's first-attendance task exists  
**When** the event is re-finalized or trigger processing runs again  
**Then** no duplicate First Attendance task is created.

## AT-017 — Host authorized access
**Given** Ahmed is assigned to ABC  
**When** Ahmed opens an ABC-hosted event  
**Then** access is permitted.

## AT-018 — Host forbidden access
**Given** Ahmed is assigned only to ABC  
**When** Ahmed requests an XYZ event by direct URL/API  
**Then** access is denied and no XYZ data is returned.

## AT-019 — Scoped aggregates
**Given** registrations exist at ABC and XYZ  
**When** ABC Host Admin opens the dashboard  
**Then** counts contain only ABC-authorized events.

## AT-020 — Scoped export
**Given** ABC Host Admin exports a roster  
**Then** the file contains only the authorized event's participant name, phone, provided email, affiliation, registration status, and attendance status, and excludes global history, coach notes, follow-up history, and other-organization activity.

## AT-021 — Global coach view
**Given** John attended events at ABC and XYZ  
**When** System Admin opens John's profile  
**Then** both histories are visible.

## AT-022 — Host participant view
**Given** John attended events at ABC and XYZ  
**When** ABC Host Admin views John through an ABC roster  
**Then** XYZ history is not displayed or returned.

## AT-023 — Calendar content
**Given** a successful registration  
**When** `.ics` is downloaded  
**Then** it contains correct title, start/end, timezone, venue, address, and instructions.

## AT-024 — Multi-event calendar
**Given** two successful registrations  
**When** Download All is selected  
**Then** one valid `.ics` contains both calendar events.

## AT-025 — Invalid form
**Given** required data is missing  
**When** participant submits  
**Then**
- clear validation errors appear
- no registration or capacity consumption occurs.

## AT-026 — Unauthorized public roster
**When** an unauthenticated user requests an admin roster endpoint  
**Then** access is denied.

## AT-027 — Attendance correction
**Given** Jane was incorrectly marked No-Show  
**When** an authorized admin corrects her to Attended  
**Then**
- attendance changes
- audit metadata records who and when
- the related no-show follow-up task is reassessed and is no longer incorrectly actionable as a no-show task.

## AT-028 — Historical affiliation
**Given** John registered while affiliated with ABC  
**When** his current affiliation later changes to XYZ  
**Then** the old Registration still reports ABC.

## AT-029 — Double submit
**When** a participant double-clicks final registration  
**Then** duplicate active registrations are not created.

## AT-030 — Archived records
**Given** a participant has history  
**When** admin archives the participant  
**Then** historical event records remain intact and the participant is excluded from default active lists.

## AT-031 — No-show follow-up
**Given** Jane is an active registration and remains unchecked at attendance finalization  
**When** an authorized admin confirms finalization  
**Then**
- Jane becomes No-Show
- exactly one pending no-show follow-up task is created
- the task is associated with Jane and the event

## AT-032 — Restricted event eligibility
**Given** Event A is Open and Affiliation Restricted to ABC Mosque  
**When** a participant selects Event A  
**Then**
- a participant affiliated with ABC Mosque may register
- a participant with another affiliation or No affiliation cannot register for Event A
- the failure is reported independently if other selected events succeed
- no invitation code or formal membership verification is required

## AT-033 — Separate acknowledgments
**Given** a participant completes the registration form  
**When** either the Participation or Data Use acknowledgment is not accepted  
**Then**
- submission is rejected with a clear validation error
- no registration or capacity is consumed
- accepted acknowledgment versions/timestamps are stored separately

## AT-034 — Host Admin operational scope
**Given** Ahmed is assigned to ABC and opens an ABC-hosted event  
**When** Ahmed performs roster operations  
**Then** Ahmed may add/cancel registrations, add walk-ins, check in participants, finalize attendance, and correct attendance, but cannot edit core event details.

## AT-035 — No-show trigger idempotency
**Given** Jane's finalized No-Show already has a pending no-show follow-up task  
**When** the event is re-finalized or no-show trigger processing runs again  
**Then** no duplicate no-show follow-up task is created.

## AT-036 — Host Admin cancellation request scope
**Given** Ahmed is assigned to ABC and an ABC-hosted event is open  
**When** Ahmed attempts to cancel the event directly  
**Then**
- direct cancellation is denied
- Ahmed may submit a cancellation request with a reason and cancellation type
- the event remains open until System Admin confirms cancellation

## AT-037 — System Admin cancellation blocks registration
**Given** Event A is open with active registrations  
**When** System Admin enters a reason and cancellation type, explicitly confirms, and cancels Event A  
**Then**
- new registrations for Event A are rejected immediately
- the event and all registration history are preserved
- check-in and attendance finalization are disabled
- cancellation audit metadata includes actor, timestamp, reason, type, and active registrations affected

## AT-038 — Cancelled event never creates no-shows
**Given** Event A is cancelled with active registrations that are unchecked  
**When** cancellation processing completes or attendance finalization is attempted  
**Then**
- no affected registration becomes No-Show
- no attendance finalization is allowed
- affected registrations receive the EVENT_CANCELLED outcome

## AT-039 — Event cancellation is not participant cancellation
**Given** John has a registration cancelled because the organizer cancelled Event A  
**When** System Admin views John's registration history  
**Then**
- the registration outcome is EVENT_CANCELLED
- it is not shown as Participant Cancelled
- the cancellation does not count negatively against John's participant history

## AT-040 — Cancellation notification idempotency
**Given** Event A has two active registrations when it is cancelled  
**When** cancellation processing is retried or the notification task trigger runs again  
**Then**
- one pending participant-notification task exists for each affected participant
- no duplicate cancellation notification tasks are created

## AT-041 — WhatsApp export includes only opted-in participants
**Given** an authorized administrator has an event with one opted-in and one opted-out registered participant  
**When** the administrator exports WhatsApp participants for that event  
**Then**
- only the opted-in participant appears
- the opted-out participant does not appear
- no unrelated event participant appears

## AT-042 — WhatsApp opt-in is optional
**Given** a participant registers for an event without joining or opting in to WhatsApp  
**When** the participant submits valid registration data and required acknowledgments  
**Then**
- registration succeeds
- no WhatsApp invitation is required
- the participant is not automatically added to a group

## AT-043 — Host Admin cannot export unrelated WhatsApp data
**Given** Ahmed is assigned only to ABC and opted-in participants exist at ABC and XYZ  
**When** Ahmed requests a WhatsApp export for an XYZ event  
**Then**
- access is denied
- no XYZ WhatsApp participant data is returned

## AT-044 — No automatic WhatsApp group addition
**Given** a participant opts in to receive an event WhatsApp invitation link  
**When** registration completes  
**Then**
- the participant remains outside the WhatsApp group
- the event roster records opt-in status
- no automatic WhatsApp API/group-add action occurs

## AT-045 — Cancellation confirmation and types
**Given** a System Admin or assigned Host Admin cancellation workflow is open  
**When** required reason, cancellation type, or explicit confirmation is missing  
**Then** cancellation cannot be finalized

## AT-046 — Cancelled event cannot be restored
**Given** Event A is cancelled  
**When** any administrator attempts to restore Event A  
**Then**
- the restore action is unavailable or rejected
- Event A remains permanently Cancelled
- EVENT_CANCELLED outcomes and prior registration/attendance history remain intact

## AT-047 — Reschedule without transfer
**Given** System Admin chooses Rescheduling Planned for Event A  
**When** the original event is cancelled and copied to a replacement date  
**Then**
- the original remains cancelled
- the replacement has no copied registrations or attendance
- affected participants must be invited to register for the replacement
- no registration is automatically transferred

## AT-048 — Exact automatic participant matching
**Given** an existing Participant has the same normalized E.164 phone, normalized first name, and normalized last name  
**When** a new registration is submitted with all three normalized values matching  
**Then** the system automatically matches the existing Participant.

## AT-049 — Shared phone and ambiguous matching
**Given** two legitimate people share a phone number, or a match conflicts on name/email  
**When** a registration is submitted  
**Then**
- the system does not automatically merge or overwrite either record
- a possible-duplicate case is created or identified for System Admin review

## AT-050 — Manual merge authorization and audit
**Given** two Participant records are confirmed duplicates  
**When** System Admin manually merges them  
**Then**
- one survivor is designated
- registrations, attendance, follow-ups, notes, and history migrate
- audit information is preserved
- duplicate active registrations are prevented
- the duplicate record is archived
**And** Host Admin cannot perform the merge.

## AT-051 — Phone normalization
**Given** one participant enters a United States number in a different display format and another enters an international number with a selected country  
**When** the numbers are parsed by the libphonenumber-compatible normalizer  
**Then**
- the United States default is +1
- the selected international country is respected
- original/display phone, E.164 phone, and country are stored

## AT-052 — Case-insensitive email comparison
**Given** a participant email is stored as `Person@Example.com`  
**When** a form submits ` person@example.com `  
**Then** comparison treats them as equivalent after trim/lowercase, without Gmail/provider-specific transformations, and email alone does not auto-merge.

## AT-053 — Indicator timing
**Given** Event A and Event B have the same start timestamp and Sarah has no prior attendance before them  
**When** Sarah attends and Event A is finalized  
**Then**
- Event A does not count itself as prior history
- Event B does not treat Event A as prior solely because of equal timestamps
- later Events starting after Event A treat finalized attendance as history

## AT-054 — Host Admin follow-up denial
**Given** Ahmed is an authorized Host Admin  
**When** Ahmed requests a participant follow-up task or global follow-up history  
**Then** access is denied, while authorized event-operational cancellation-notification status remains available.

## AT-055 — Full-capacity walk-in handling
**Given** an Event is at published capacity  
**When** Host Admin attempts to add a walk-in  
**Then** the walk-in is blocked.  
**When** System Admin uses Over-Capacity Override  
**Then** warning, reason, confirmation, identity, timestamp, capacity, and resulting count are recorded and published capacity is unchanged.

## AT-056 — Attendance finalization and correction lifecycle
**Given** an authorized admin opens an Event attendance state  
**When** the admin finalizes attendance and later corrects one participant with a reason  
**Then**
- the state transitions through OPEN to FINALIZED
- checked-in participants remain ATTENDED
- unchecked active registrations become NO_SHOW
- participant-cancelled registrations remain preserved
- finalization/correction actor, time, and reason are audited

## AT-057 — Attendance reopening and idempotent re-finalization
**Given** an Event is FINALIZED  
**When** System Admin reopens it with a reason and later re-finalizes it  
**Then**
- the state becomes REOPENED and requires re-finalization
- existing statuses remain until corrected
- follow-up triggers are safely reassessed
- no duplicate follow-up tasks are created
- Host Admin cannot reopen the entire Event

## AT-058 — DST-safe event display and calendar export
**Given** an Event uses an IANA timezone with a daylight-saving transition  
**When** the Event is displayed and exported to Google Calendar and ICS  
**Then**
- stored instants remain UTC
- public/admin display uses the Event local timezone
- registration deadline uses Event timezone
- exports preserve the Event IANA timezone and correct local time
- changing the Venue timezone does not alter the existing Event

## AT-059 — Administrator invitation lifecycle
**Given** System Admin invites a Host Admin with required email and organization assignment  
**When** the invitation is created, resent, revoked, accepted, or expires  
**Then**
- status begins PENDING and accepted status becomes ACTIVE
- token is single-use, hashed, cryptographically random, and expires after 72 hours
- expired, revoked, replaced, or already-accepted tokens cannot be used
- System Admin may suspend/reactivate the account and change assignments
- no public signup or production default password exists

## AT-060 — Exact acknowledgment-version retrieval
**Given** a participant accepts a specific PARTICIPATION_RISK, DATA_USE, and optional WHATSAPP_DISCLOSURE version  
**When** an administrator or audit process retrieves the acceptance  
**Then**
- exact type, version, text, content hash, legal status, effective/retired data, participant, Registration Group, timestamp, method, IP, and user agent resolve correctly
- later publication of a new version does not change the historical text

## AT-061 — Confirmation token security
**Given** a Registration Group confirmation token is issued  
**When** a user uses the valid token, an expired token, or a guessed/sequential token  
**Then**
- only the valid token shows that submission's results/calendar links
- expired and guessed/sequential tokens are denied
- no token exposes participant history or authenticates the participant
- the token works without requiring email delivery

## AT-062 — Provisional legal status blocks production
**Given** the Participation acknowledgment version has legal status PROVISIONAL  
**When** a production deployment is attempted  
**Then** deployment is blocked until legal approval and an approved acknowledgment version exist.

## AT-063 — Immediate cancellation notification task
**Given** Event A is cancelled at a known timestamp  
**When** cancellation processing completes  
**Then**
- one notification task exists per affected participant
- created_at and due_at equal the cancellation timestamp
- priority is HIGH
- Event start time and time remaining are displayed

## AT-064 — Editable cancellation templates
**Given** an Event cancellation type is Permanent, Replacement Date to Be Announced, or Replacement Event Available  
**When** an administrator opens the participant-notification task  
**Then** the corresponding default template is available, editable, and copyable, and the system does not send it automatically.

## AT-065 — Notification completion permissions
**Given** an affected Event has an overall cancellation notification task and individual Registration delivery records  
**When** an assigned Host Admin updates an individual delivery status  
**Then** the individual status may change, but Host Admin cannot complete or dismiss the overall task.  
**When** System Admin confirms the process is complete  
**Then** System Admin may complete or dismiss the overall task.

## AT-066 — Manual notification SENT tracking
**Given** an administrator manually sends a cancellation message outside the system  
**When** the administrator records SENT for a Registration  
**Then** status, channel, sent_at, sent_by_admin_id, and delivery_note are stored, and the system does not claim delivery or read confirmation.

## AT-067 — Cancellation request approval/rejection/withdrawal
**Given** an assigned Host Admin submits a cancellation request  
**When** the request is PENDING  
**Then** the submitting Host Admin may withdraw it, and only System Admin may approve or reject it.  
**When** System Admin rejects it  
**Then** a rejection reason is required and the Event is unchanged.  
**When** System Admin approves it  
**Then** cancellation is triggered. All decisions remain in audit history.

## AT-068 — Replacement Event is separate
**Given** Event A is permanently cancelled for rescheduling  
**When** System Admin copies it for a replacement date  
**Then**
- the replacement is a separate Draft Event
- the replacement has no transferred registrations or attendance
- affected participants must register again after the replacement opens

## AT-069 — WhatsApp export does not mark Sent
**Given** selected participants are opted in for an authorized Event  
**When** an administrator copies invitation text or exports the WhatsApp list  
**Then** invitation statuses remain unchanged and are not automatically marked SENT.

## AT-070 — Exact WhatsApp export columns and exclusions
**Given** an authorized administrator exports opted-in participants for one Event  
**When** the default WhatsApp export is generated  
**Then** it contains only Event Name, Event Date, Participant First Name, Participant Last Name, Display Phone, E.164 Phone, Email, Primary Affiliation, WhatsApp Opt-In, Invitation Status, Invitation Sent At, and Registration Status, and excludes notes, global/no-show/follow-up history, other-organization activity, fitness experience, acknowledgment audit data, IPs, and internal IDs.

## AT-071 — Explicit Mark Invitation Sent
**Given** an authorized administrator has filtered opted-in Registrations in the Event roster  
**When** the administrator explicitly selects Registrations and clicks Mark Invitation Sent  
**Then** selected records become SENT with channel WHATSAPP, timestamp, and administrator; the administrator can reset them to PENDING or mark FAILED with an optional note.

## AT-072 — Unauthorized WhatsApp export denial
**Given** Ahmed is assigned only to ABC and opted-in Registrations exist for XYZ  
**When** Ahmed requests a WhatsApp export for the XYZ Event  
**Then** access is denied and no XYZ data is returned.

## AT-073 — Per-Registration WhatsApp opt-in isolation
**Given** Sarah registers for Event A and Event B  
**When** Sarah opts in for Event A and declines for Event B  
**Then**
- Event A stores opt-in timestamp and disclosure version
- Event B remains opted out
- Event A's opt-in does not carry to Event B

## AT-074 — Provisional acknowledgment remains blocked
**Given** development uses the provisional Participation acknowledgment  
**When** the system evaluates production readiness  
**Then** development/testing may continue, but production deployment remains blocked until an approved acknowledgment version exists and the UI/docs do not describe provisional text as legally approved or sufficient.

## AT-075 — Notification delivery transitions
**Given** an affected Registration has a PENDING notification delivery
**When** an authorized administrator changes its status
**Then** only the documented transitions are accepted, every transition records previous/new state, actor, timestamp, channel, and optional note, and invalid transitions are rejected.

## AT-076 — Notification transition authorization
**Given** a Host Admin is assigned to the Event
**When** the Host Admin attempts to reset SENT, change DECLINED, or mark NOT_REQUIRED
**Then** the action is denied. System Admin may perform those actions, subject to the same transition rules.

## AT-077 — Notification completion blocking
**Given** an overall cancellation-notification task has affected Registrations
**When** any delivery is PENDING or FAILED
**Then** normal completion is blocked. When every delivery is SENT, DECLINED, or NOT_REQUIRED, System Admin may complete the task.

## AT-078 — Complete With Exceptions
**Given** unresolved PENDING or FAILED deliveries remain
**When** System Admin selects Complete With Exceptions
**Then** a reason is required and the unresolved recipients, statuses, actor, timestamp, and reason remain in audit history.

## AT-079 — Immutable cancellation templates
**Given** a published cancellation template
**When** System Admin edits its text
**Then** a new version is created, the prior version remains unchanged, and new cancellations may select the new version.

## AT-080 — Rendered cancellation snapshot
**Given** a cancellation uses a template version
**When** the cancellation is confirmed and the template is later changed
**Then** the cancellation retains the selected version, rendered message snapshot, and administrator edits exactly as they were at cancellation.

## AT-081 — Replacement link publication rule
**Given** a cancellation references a replacement Event
**When** the replacement remains Draft
**Then** no replacement link is rendered. When the replacement is published, the canonical public Event URL is rendered without internal identifiers.

## AT-082 — Cancellation request cardinality and resubmission
**Given** an Event has a PENDING cancellation request
**When** a Host Admin submits another request or materially edits the pending request
**Then** the action is denied. After the original request is REJECTED or WITHDRAWN, a new request may be submitted.

## AT-083 — Atomic cancellation rollback
**Given** a PENDING cancellation request
**When** one cancellation-approval step fails
**Then** the request, Event, registrations, notification records, tasks, and audit effects remain unchanged.

## AT-084 — Idempotent cancellation approval retry
**Given** cancellation approval succeeds
**When** the same approval command is retried
**Then** no duplicate cancellation record, EVENT_CANCELLED outcome, notification delivery, or overall task is created.

## AT-085 — Participant merge contact conflict
**Given** two Participants have conflicting valid phone or email values
**When** System Admin merges them
**Then** the administrator must select retained values; conflicting values are not silently overwritten and may remain secondary/historical.

## AT-086 — Participant merge affiliations and duplicates
**Given** a merge includes distinct affiliations and duplicate active Registrations for one Event
**When** System Admin completes the merge
**Then** all affiliations are preserved, a primary affiliation is selected, one active Registration remains, the duplicate is archived as MERGED_DUPLICATE, and both histories remain auditable.

## AT-087 — Participant merge attendance conflict
**Given** merged records contain ATTENDED and NO_SHOW outcomes
**When** System Admin resolves the conflict
**Then** ATTENDED is selected by default, an explicit alternative requires a reason, acknowledgment records remain unchanged, and the source Participant is archived.

## AT-088 — Invitation acceptance identity and assignments
**Given** a PENDING invitation with organization assignments
**When** the invitee verifies the invited email and accepts
**Then** Auth linkage, admin-profile linkage, organization activation, invitation acceptance, and profile activation succeed together. The invitee cannot alter assignments.

## AT-089 — Invitation email mismatch and no-assignment suspension
**Given** an invitation or accepted profile has an email mismatch or no active organization assignments
**When** activation is attempted or access is evaluated
**Then** activation is denied or Host Admin access is suspended, and no incorrectly scoped access is granted.

## AT-090 — Acknowledgment legal lifecycle
**Given** an acknowledgment version in each supported legal status
**When** an administrator attempts a status transition or uses it for registration
**Then** only approved transitions are accepted, only APPROVED versions are production-usable, PROVISIONAL is development/testing-only, and RETIRED/REVOKED versions cannot be used for new registrations.

## AT-091 — Acknowledgment evidence retention
**Given** a Participant accepted an acknowledgment version
**When** that version is retired or revoked
**Then** the exact text, version, hash, participant, group, time, method, IP, and user agent remain unchanged and ordinary administrators cannot delete them.

## AT-092 — Confirmation-token regeneration and access
**Given** a Registration Group has an active confirmation token
**When** a new token is generated
**Then** the prior token is revoked, only the new token is active, valid access is read-only and scoped to the same confirmation page, and access metadata is recorded.

## AT-093 — Confirmation-token abuse controls
**Given** repeated invalid token attempts or excessive regeneration requests
**When** the configured limits are exceeded
**Then** further attempts are rate-limited, a generic invalid-link response is returned where applicable, and security/audit logs record the repeated invalid activity.

## AT-094 — DST nonexistent local time
**Given** an Event time falls in a spring-forward gap for its selected IANA timezone
**When** an administrator saves the nonexistent local time
**Then** the value is rejected with an explanation and is not silently adjusted.

## AT-095 — DST duplicated local time
**Given** an Event time occurs twice during fall-back
**When** an administrator enters the local time
**Then** the UI requires first or second occurrence selection, stores the corresponding UTC instant and IANA timezone, and displays the selected offset/abbreviation.

## AT-096 — Over-Capacity Override audit
**Given** a System Admin approves an over-capacity Registration
**When** the Registration is created
**Then** exactly one immutable Override record stores Event, Registration, administrator, reason, source, timestamp, capacity, and before/after counts; Event capacity is unchanged and cancellation does not delete the record.

## AT-097 — Cancellation before or during open attendance
**Given** an Event is cancelled before attendance opens or while attendance is OPEN
**When** cancellation completes
**Then** before opening no Attendance records are created; while OPEN existing check-ins are preserved and represented as EXCUSED or the approved equivalent, unchecked active Registrations become EVENT_CANCELLED, and no No-Show is created.

## AT-098 — Finalized attendance cancellation protection
**Given** an Event has FINALIZED attendance
**When** an administrator uses standard cancellation
**Then** cancellation is blocked. When System Admin uses exceptional invalidation, a reason, confirmation, and audit record are required, finalized history and transition records are preserved, and completed outcomes are not silently rewritten.

## Post-MVP Phase 7 acceptance tests

These scenarios are planned/pending and are not implemented by this documentation update.

### AT-099 — Publish and share event
Given an eligible draft event and an authorized administrator, when the administrator publishes it, copies its canonical URL, opens that URL anonymously, and later unpublishes it, then the public page is available only while published and the same URL becomes unavailable after unpublishing. (FR-087–FR-092)

### AT-100 — Stable safe slug
Given event information containing unsupported characters or a collision, when a slug is suggested and validated, then it is lowercase, URL-safe, bounded, reserved-word protected, collision-safe, stable after publication unless deliberately changed, and contains no private identifier or participant data. (FR-088–FR-089)

### AT-101 — Canonical URL construction
Given local, staging, and production-like configuration, when a public or invitation link is generated, then it uses the explicit canonical base URL, normalizes trailing slashes, requires HTTPS outside local development, and never uses a user-supplied Host header or authentication token. (FR-089, FR-094)

### AT-102 — Availability states
Given events in draft/unpublished, not-yet-open, open, paused, closed, full, cancelled, and legally blocked states, when an anonymous user visits or submits registration, then each state shows a safe distinct unavailable/open result and server/database checks enforce the same state. (FR-090–FR-091, FR-104)

### AT-103 — Link copy and preview have no side effect
Given an authorized administrator and an unpublished event, when the administrator previews or copies its URL, then the event remains unpublished and no registration is created. (FR-092)

### AT-104 — QR canonical payload
Given a published event, when an authorized administrator generates a high-contrast QR artifact, then decoding it yields exactly the canonical public URL with no private ID, token, participant data, tracking parameter, or analytics destination. (FR-093)

### AT-105 — QR does not bypass state
Given a QR generated for a published event, when the event is unpublished or otherwise unavailable, then visiting the decoded destination is unavailable under the same publication and registration rules. (FR-091, FR-093)

### AT-106 — Create administrator invitation
Given a System Admin, intended email, Host Admin role, and Organization A assignment, when an invitation is created, then a pending invitation and one-time canonical invitation URL are produced, the assignment is read-only to the invitee, and no email is sent automatically. (FR-095–FR-096)

### AT-107 — Invitation token storage
Given a newly generated invitation, when the database and logs are inspected, then only a secure token hash is retained and no raw token appears in reusable fields, audit data, logs, analytics, or browser bundles. (FR-096)

### AT-108 — Invitation acceptance
Given a valid pending invitation, when the intended authenticated user accepts it with matching identity, then exactly one appropriate administrator profile and Organization A assignment are activated and the invitation becomes accepted. (FR-098)

### AT-109 — Invitation invalidation
Given an invitation, when it expires, is revoked, is accepted, or is regenerated, then the prior URL fails safely and does not create or change administrative access. (FR-097)

### AT-110 — Invitation regeneration
Given a pending invitation, when System Admin generates a replacement link, then the prior hash is invalidated, the new token has a new expiration, and only the new link can be accepted. (FR-097)

### AT-111 — Invitation concurrency
Given one valid invitation, when two acceptance requests run concurrently or acceptance is retried, then at most one succeeds, no duplicate admin profile or assignment is created, and no partial privilege remains. (FR-099)

### AT-112 — Existing-account behavior
Given the invited email already belongs to an authenticated user, when that user verifies identity and accepts, then the existing Auth user is linked without duplication; email input alone cannot claim the account and conflicts require safe System Admin resolution. (FR-098–FR-099)

### AT-113 — Invitation authorization matrix
Given System Admin, assigned Host Admin, unassigned Host Admin, inactive admin, authenticated non-admin, and anonymous users, when they access invitation management or acceptance operations, then only the intended System Admin/invitee paths succeed and no role or assignment can be altered by the invitee. (FR-098–FR-101)

### AT-114 — Cross-organization publication isolation
Given Organization A and B events, when an A Host Admin attempts to view, publish, unpublish, pause, resume, edit slug, copy, preview, or generate a QR code for a B event, then access is denied without B management data leakage. (FR-100–FR-101)

### AT-115 — Public privacy
Given published, unpublished, and unrelated events, when anonymous public routes are requested, then only approved registration-page fields for the addressed published event are returned and no internal IDs, admin details, participant data, notes, tokens, unrelated events, or raw errors appear. (FR-089, FR-091, FR-102)

### AT-116 — Publication audit
Given authorized publication, availability, slug, and invitation lifecycle actions, when audit history is reviewed, then actor, timestamp, subject, organization, and prior/new state are present and raw tokens are absent. (FR-103)

### AT-117 — Legal gate at page/server/database layers
Given a provisional Participation acknowledgment, when a production-like public page, server action, modified request, or direct registration RPC is used, then registration is denied before participant data submission at every layer while synthetic local registration remains permitted. (FR-091, FR-104)

### AT-118 — Environment safety
Given local, staging, and production-like environments with missing, invalid, or valid base URL/legal-readiness configuration, when links or registration are requested, then local fallback is safe, staging identifies itself as non-production, and production fails closed without inferring readiness from environment variables alone. (FR-094, FR-104)

### AT-119 — Slug tampering
Given nonexistent, malformed, uppercase-equivalent, reserved, unpublished, cancelled, full, expired-window, and legally blocked slugs, when requested, then responses are safe and non-enumerating and no state bypass occurs. (FR-088–FR-091)

### AT-120 — Registration window boundaries
Given opening and closing instants, when requests occur immediately before, at, and after each boundary using server/database time, then the authoritative availability state is correct and capacity/cancellation/legal checks still apply. (FR-090–FR-091)

### AT-121 — Pause/resume authorization
Given an open event, when an authorized administrator pauses or resumes registration, then the public state changes accordingly, publication remains unchanged, and unauthorized or cross-organization actions fail. (FR-090, FR-100–FR-101)

### AT-122 — QR filename/accessibility
Given a generated QR artifact, when it is downloaded or rendered, then the filename is safe and event-identifying, output is printable/high contrast, and an accessible text alternative exposes the canonical destination without tokens. (FR-093)

### AT-123 — No tracking links
Given a copied public URL or decoded QR URL, when its query and path are inspected, then no tracking parameters or third-party analytics destination is present. (FR-089, FR-093, BR-119)

### AT-124 — Repeated publication idempotency
Given a published or unpublished event, when publish/unpublish is repeated or concurrent, then the final state is stable, no duplicate public identity is created, and audit history records only approved transitions/retries. (FR-087, FR-103)

### AT-125 — Invitation role tampering
Given a Host Admin invitation, when a request attempts to change its role or organization assignment, then the request is rejected and the original invitation scope remains authoritative. (FR-098)

### AT-126 — Inactive organization invitation
Given a pending invitation referencing an inactive organization, when it is accepted or regenerated, then activation fails safely and no active improperly scoped administrator exists. (FR-098–FR-099)

### AT-127 — No raw token after dismissal
Given an invitation creation or regeneration result, when the one-time URL display is dismissed and the page is revisited, then the raw token cannot be retrieved from the application. (FR-095–FR-097)

### AT-128 — Safe errors
Given unavailable events, invalid slugs, malformed tokens, unauthorized actions, and unexpected failures, when the user receives a response, then it uses an approved safe category and omits table names, RPC names, SQL, stacks, hashes, and administrator existence. (FR-091, FR-097, FR-102)

### AT-129 — Mobile and keyboard flow
Given a mobile viewport and keyboard-only interaction, when a participant uses the public page and an administrator copies/previews/generates a link, then controls have accessible labels, visible focus, usable touch targets, and clear loading/error feedback. (FR-089, FR-092–FR-093)

### AT-130 — Synthetic fixture isolation
Given a database reset, when local Phase 7 fixtures are regenerated, then Auth IDs are fresh, data is synthetic, no credentials/tokens/storage state are committed, and tests do not depend on execution order. (BR-130, BR-135)

### AT-131 — Phase 1–6 regression preservation
Given a clean reset and the Phase 1–6 suite, when Phase 7 is implemented later, then all prior schema, runtime, unit, component, and browser validations remain passing and migrations `0001–0019` are byte-for-byte unchanged. (BR-134–BR-136)

### AT-132 — Scope exclusions
Given the Phase 7 implementation plan, when the final scope is reviewed, then automated messaging, participant accounts/login, merging, analytics/tracking/QR analytics, payments, deployment, legal approval, and Phase 8 work are absent. (FR-105, BR-131)
