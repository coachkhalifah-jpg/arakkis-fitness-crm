# 07 — UI Specification

## Design principles
- Mobile-first public registration.
- Fast event-day operation on a phone.
- Clear status language.
- Few primary navigation areas.
- Actionable information before charts.
- Accessibility: keyboard support, labels, contrast, error messages, touch targets.

## DEC-052 administrator workspace presentation

Authenticated administrator list pages use a reusable URL-backed two-mode segmented control only when an approved existing action workflow exists: Events/Create, Organizations/Create, Venues/Create, and Invitations/Invite. Participants intentionally remains Search/Profile because manual participant creation is not approved. The admin shell uses soft-white and warm-gray semantic tokens, local replaceable assets, a focus-safe contextual back link that fades after scroll, and event cards with text KPIs. Quick rosters are scoped operational summaries and link to the full roster; they do not replace attendance correction workflows.

## Public screens

### Public event schedule
Cards/list containing:
- event name
- host organization
- venue
- date/time
- visibility: Public or Affiliation Restricted
- eligible organizations when restricted
- spots available, Full, or Registration Closed
- selection checkbox
- Continue button

Filters are not required in MVP unless event volume demands them.

### Registration form
Collect participant information once after date selection.

Sections:
1. Selected events summary
2. Contact information
3. Affiliation
4. Optional fitness experience/note
5. Participation acknowledgment (required; provisional wording, legal review required before production)
6. Data Use acknowledgment (required)
7. Optional WhatsApp invitation opt-in
8. Review and submit

The registration form must display these separate acknowledgments:

**Participation**

“I understand that participation in physical exercise involves inherent risks. I confirm that I am choosing to participate voluntarily and will follow the coach’s safety instructions, work within my abilities, and stop if I experience pain, dizziness, or unusual discomfort.”

**Data use**

“I agree that the information I provide may be used to manage my registration, attendance, event communication, and relevant follow-up.”

When the participant opts in to WhatsApp invitations, show: “Joining a WhatsApp group can expose your WhatsApp profile name and phone number to other group members.” The participant can complete registration without opting in.

Phone input defaults to United States (+1) and allows country selection. Email is optional and compared case-insensitively after trimming/lowercasing without provider-specific transformations.

### Confirmation
Display separate sections:

**Registered**
- successful events
- Google Calendar button
- Download `.ics`
- Download all events

**Not registered**
- event
- failure reason such as Full, Deadline Passed, Already Registered

**Event cancelled**
- event
- cancellation notice and organizer-provided reason where appropriate
- no No-Show or participant-cancellation language

Confirmation pages use an opaque, read-only token that expires after 24 hours and exposes only that submission's results and calendar links.

## System Admin navigation
- Dashboard
- Events
- Participants
- Follow-Ups
- Organizations
- Settings

## Host Admin navigation
- Dashboard
- Events
- optional profile/account

Do not show inaccessible global navigation.

## System dashboard
Widgets:
- Next event
- registrations / capacity
- available spots
- affiliation-restriction eligibility where applicable
- first time with coach
- first time at host
- follow-ups due/overdue
- upcoming events
- recent registrations/activity

## Host dashboard
Widgets:
- assigned organization context
- upcoming hosted events
- registrations / capacity
- first time at this host
- recent attendance summary

No global participant or follow-up metrics.

## Event roster screen
Header:
- event name
- host
- venue
- date/time
- event status

Metrics:
- active registrations / capacity
- available spots
- attendance processing state: NOT_STARTED, OPEN, FINALIZED, or REOPENED
- first time with coach
- first time at host
- returning

Actions:
- Add Participant
- Add Walk-In
- Over-Capacity Override, System Admin only when full; requires warning, reason, confirmation, identity, timestamp, and capacity/result counts
- Start/Open Check-In
- Export CSV
- Edit Event, System Admin only
- Cancel Event, System Admin only
- Request Cancellation, Host Admin for assigned events
- WhatsApp invitation link/message, System Admin manages; authorized admins may copy the message
- Finalize Attendance
- Reopen Attendance, System Admin only; requires reason and confirmation

Table/list fields:
- participant name
- affiliation
- phone
- email where appropriate
- registration time/status
- attendance status
- WhatsApp invitation opt-in
- WhatsApp invitation-sent status
- indicators
- actions

Host Admin exports are limited to the authorized event and contain only name, phone, provided email, affiliation, registration status, and attendance status. They do not contain global history, coach notes, follow-up history, or other-organization activity.

The WhatsApp export action is separate and includes exactly: Event Name, Event Date, Participant First Name, Participant Last Name, Display Phone, E.164 Phone, Email, Primary Affiliation, WhatsApp Opt-In, Invitation Status, Invitation Sent At, and Registration Status. By default it includes only active opted-in Registrations for the selected authorized Event. Cancelled/EVENT_CANCELLED rows require an explicit filter. It excludes notes, global/no-show/follow-up history, other-organization activity, fitness experience, acknowledgment audit data, IP addresses, and internal identifiers.

## Required indicator labels
- `First with Coach`
- `First at This Location` or `First at This Host`
- `Returning`
- `NOT_RECORDED`, `ATTENDED`, `NO_SHOW`, or `EXCUSED`
- `Cancelled`
- `Follow-Up Due`

Finalized `No-Show` rows show the related pending no-show follow-up state. Correcting attendance visibly reassesses that task.

Cancelled events show `Event Cancelled`, disable check-in/finalization actions, and do not show active unchecked registrations as candidates for No-Show.

A participant can simultaneously be Returning and First at This Host.

## Check-in mode
Optimize for event-day mobile use:
- large searchable roster
- one-tap Attended action
- visible checked-in count
- Add Walk-In
- undo/correct
- finalize button with warning
- confirmation that unchecked active registrations will become No-Show and create pending no-show follow-up tasks
- attendance state and actor/time for open, finalize, reopen, and correction actions

## Participant profile, System Admin only
Header:
- name
- contact
- current primary affiliation
- status

Summary:
- first registration
- first attendance
- last attendance
- total attended
- cancellations
- no-shows

Sections:
- upcoming registrations
- event history
- follow-up history
- notes

## Follow-up queue
Group by:
- Overdue
- Today
- Upcoming

Task card:
- participant
- reason
- related event
- due time
- suggested message preview
- Edit
- Copy
- Complete
- Dismiss

The queue includes pending no-show tasks. Messages are editable and copyable; sending occurs outside the system. Host Admins do not see the global follow-up queue in MVP.

Possible-duplicate cases, participant merge controls, and merge audit/history are visible to System Admin only. Host Admins cannot merge Participants.

Event cancellation creates participant-notification tasks immediately and exactly once per affected participant, with HIGH priority, created_at/due_at equal to cancellation time, Event start time, and time remaining. Tasks contain copyable editable notification text and remain separate from participant follow-up history. Only System Admin may complete/dismiss the overall task; assigned Host Admins may update individual delivery records.

## Event cancellation

Cancellation form:
- reason, required
- cancellation type: Permanent, Rescheduling Planned, or Replacement Date to Be Announced
- explicit confirmation
- active registration count affected

System Admin sees Confirm Cancel only; cancelled events cannot be restored in MVP. Host Admin sees Submit Cancellation Request only for assigned events and never a direct cancellation action. Cancelled event details show actor, timestamp, reason, type, and affected count.

Cancellation requests show PENDING, APPROVED, REJECTED, or WITHDRAWN. The submitting Host Admin may withdraw a PENDING request. Only System Admin may approve/reject; rejection requires a reason. Approved, rejected, and withdrawn decisions remain in audit history.

## WhatsApp event group

System Admin event settings may store an optional invitation link. The event page shows opt-in count and invitation-sent count. The roster is authoritative: admins filter to opted-in Registrations, copy text or export, explicitly select Registrations, and click Mark Invitation Sent. This records SENT, WHATSAPP, timestamp, administrator, and supports reset to PENDING or FAILED with an optional note. Copying/exporting never marks SENT. No automatic group addition or direct WhatsApp API action appears in MVP.

## Administrator invitations

Public administrator signup is not shown. System Admin creates Host Admin invitations with required email and organization assignments. The invite shows PENDING status, expiry after 72 hours, and accept/resend/revoke actions according to permission. Invitation tokens are never displayed after creation.

## Organization administration
- organization list
- details
- assigned Host Admins
- upcoming/past events
- venue associations

## Settings and compliance

- System Admin-only acknowledgment version list showing type, version, exact text, hash, effective/retired timestamps, and legal status.
- Publish a new immutable acknowledgment version; never edit historical text.
- Display a production deployment warning/block when PARTICIPATION_RISK remains PROVISIONAL.
- System Admin-only administrator invitation list with PENDING, accepted, expired, revoked, and replaced states.
- Possible-duplicate review and manual merge controls are System Admin-only and show merge audit/history.

## Architecture-critical operational UI

### Cancellation notifications
- Show each affected Registration's delivery status, channel, transition history, actor, timestamp, and note.
- Permit Host Admins only the authorized transitions for assigned Events.
- Show normal completion blocked while any delivery is PENDING or FAILED.
- Show System Admin-only Complete With Exceptions, requiring a reason and displaying unresolved recipients.
- Show System Admin-only controls for resetting SENT, changing DECLINED, and marking NOT_REQUIRED.

### Cancellation templates
- System Admin manages immutable template versions for the three approved cancellation types.
- Published text cannot be edited in place; edits create a new version.
- Cancellation detail shows the selected version, rendered-message snapshot, and administrator edits.
- Replacement links appear only when the replacement Event is published and use its canonical public URL.

### Invitation acceptance
- Invitee verifies the invited email before accepting.
- The acceptance screen shows assigned organizations as read-only.
- Acceptance must not complete until Auth linkage, organization activation, invitation acceptance, and profile activation succeed together.
- A Host Admin with no active assignments is shown as suspended from Host Admin access.

### Merge conflicts
- System Admin must select the survivor and explicitly resolve contact, primary-affiliation, duplicate-registration, and attendance conflicts.
- The UI must show that acknowledgment evidence is preserved, duplicate registrations are archived as MERGED_DUPLICATE, and merges are irreversible in MVP.

### Time and attendance edge cases
- Reject nonexistent DST local times with an explanation.
- Require first/second occurrence selection for duplicated DST times and display the selected offset.
- Show immutable attendance-transition history.
- Before attendance opens, cancellation creates no attendance rows; while OPEN, show the required System Admin confirmation and EXCUSED handling; after FINALIZED, standard cancellation is blocked and exceptional invalidation requires reason/confirmation/audit.

## Post-MVP Phase 7 — Publishing and distribution UI

### Public event page

The canonical event route is `/register/{public-slug}`. It shows only approved event name/description, host organization, venue, venue-local date/time, instructions, capacity state, registration availability, and legal-gate/unavailable messaging. It never shows internal IDs, participant/admin data, private notes, or audit details. Availability states include not yet open, open, paused, closed, full, cancelled, unpublished, unavailable, and production legally blocked.

For a recurring series, the route is the canonical series slug and shows the
upcoming published occurrences within the rolling 14-day selection window. A
participant may select multiple dates; each selected date is submitted and
validated as an independent Event registration. Event descriptions render as
escaped plain text with preserved whitespace; Markdown and automatic links are
not interpreted.

The public hub uses centered identity, stacked event cards, a primary action,
responsive layout, keyboard-visible focus, and a reduced-motion mode. Desktop
and mobile background assets are replaceable static files with a safe fallback
gradient.

After a successful registration, the confirmation page may show one optional
HTTPS communication CTA using the event-provided label. It is not shown before
registration or for failed results.

### Link management

Authorized administrators see publication status, registration availability, public slug, complete canonical URL, opening/closing times, capacity/full state, legal-gate state, last published time, and audited actor. Controls include publish, unpublish, pause, resume, preview, copy link, and generate QR. Copy, preview, and QR generation have no publication or registration side effect. Copy feedback is visible, keyboard accessible, and does not store clipboard contents.

### QR distribution

The QR download is high contrast, printable, uses a safe event-identifying filename, and includes an accessible text alternative containing the canonical URL. The encoded value is exactly the canonical public URL and never includes tracking parameters or tokens.

### Administrator invitations

System Admins create Host Admin invitations with required email and read-only organization assignments. The one-time URL is displayed only at creation/regeneration for private copying; the UI explains that no email is sent automatically, links expire, each link is single-use, and exposed links should be revoked. The normal `/login` route remains the only post-activation login route. Invitees cannot change role or assignments.

### Environment and legal warning

Local is labeled development and may use synthetic registration. Staging is labeled non-production. Production registration remains unavailable while the Participation acknowledgment is PROVISIONAL; the warning is not presented as legal approval and remains enforced beyond the UI.
# DEC-051 participant booking direction

The public experience uses a horizontal snap-scrolling class carousel, a focused class environment after selection, date-grouped time choices, a persistent selected-class summary, and participant-facing `Book Class` copy. Navigation remains accessible and browser history remains normal. Reduced motion removes non-essential transitions.
