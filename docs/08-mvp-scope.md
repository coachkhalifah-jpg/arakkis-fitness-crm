# 08 — MVP Scope

## MUST HAVE

### Public registration
- Public upcoming event schedule
- Multi-date selection
- Mobile-friendly form
- Contact and affiliation collection
- Independent event validation
- Partial success
- Duplicate active registration prevention
- Confirmation results
- Public and Affiliation Restricted events with eligible organizations
- Separate required Participation and Data Use acknowledgments; Participation wording requires legal review before production
- Google Calendar links
- individual and multi-event `.ics`
- Opaque 24-hour registration confirmation token

### Event management
- Organizations
- Venues
- Create/edit/copy event
- Draft/Open/Closed/Completed/Cancelled
- Public or Affiliation Restricted visibility
- Capacity
- Capacity cannot be saved below active registrations
- Full-capacity walk-in denial for Host Admin and explicit System Admin Over-Capacity Override
- Registration deadline
- Public link
- System Admin-only direct cancellation; cancelled events cannot be restored
- Host Admin cancellation requests for assigned events
- Cancellation reason, type, confirmation, audit metadata, preserved history, and affected active-registration count
- Cancellation blocks registration/check-in/finalization, prevents No-Show, creates idempotent participant-notification tasks, and uses explicit EVENT_CANCELLED outcomes
- Rescheduling by cancel-and-copy with no automatic registration transfer
- Immediate HIGH-priority cancellation tasks with editable templates, per-Registration delivery tracking, and System Admin-only overall completion
- Immutable versioned cancellation templates with rendered-message snapshots and published replacement-event links only
- Notification delivery state transitions, completion blocking, and System Admin Complete With Exceptions
- PENDING/APPROVED/REJECTED/WITHDRAWN cancellation request workflow
- Atomic, idempotent cancellation approval and one-pending-request-per-Event rule

### Administration
- System Admin authentication
- Host Admin authentication
- Organization assignments
- Database/server-side scoped authorization
- System dashboard
- Host dashboard

### Event operations
- Event roster
- Manual registration
- Add walk-in
- Cancellation
- One-action check-in
- Finalize attendance
- Automatic pending no-show follow-up task for each finalized No-Show
- No-show handling
- Attendance correction
- NOT_STARTED/OPEN/FINALIZED/REOPENED attendance lifecycle with System Admin-only event reopening
- CSV event roster export
- Host Admin exports limited to assigned events and approved event-operational fields
- Event-scoped WhatsApp opt-in and invitation-sent status
- Per-Registration WhatsApp opt-in and disclosure version
- Exact opted-in WhatsApp export columns and exclusions
- Explicit Mark Invitation Sent/reset Pending/mark Failed workflow; copy/export never marks SENT
- Copyable WhatsApp invitation message

### Participant CRM
- One global participant profile
- Current primary affiliation
- historical affiliation per registration
- event/attendance history
- first time with coach
- first time at host
- returning
- search
- System Admin notes
- Conservative normalized participant matching
- System Admin-only possible-duplicate review and manual merge with audit/history migration
- Explicit participant merge conflict resolution and irreversible archival

### Follow-up
- task queue
- first-attendance trigger
- suggested editable/copyable message
- completion/dismissal
- task history
- idempotency
- no-show task reassessment after attendance correction
- System Admin-only participant follow-up access

### Architecture-critical MVP controls
- Single-active-token lifecycle, revocation, access logging, and abuse-rate limits
- DRAFT/PROVISIONAL/APPROVED/RETIRED/REVOKED acknowledgment lifecycle with immutable evidence
- DST-invalid input rejection and duplicated-time disambiguation
- Immutable Over-Capacity Override records
- Immutable attendance-transition history and cancellation behavior by attendance processing state

### Privacy/security
- role-based access
- host organization scope
- protected participant data
- input validation
- no secrets in browser/repository
- historical record preservation
- UTC/IANA timezone and DST-safe display/deadline/calendar behavior
- Invite-only administrator provisioning with expiring hashed tokens
- Immutable versioned acknowledgments with acceptance evidence
- Production deployment blocked while Participation acknowledgment is PROVISIONAL

## SHOULD HAVE — Phase 2
- Participant self-cancellation
- Automated email confirmation
- Waitlist
- Configurable no-show task rule
- Re-engagement filters/tasks
- Advanced recurring event series (the approved weekly-series extension is limited to one weekly cadence, an inclusive end date, materialized occurrences, and a 14-day participant selection window)
- Multiple System Admin users with richer permissions
- Configurable registration questions
- Automated delivery of event cancellation notifications
- Direct WhatsApp Groups API integration
- basic trends/reporting

## COULD HAVE — Future
- SMS
- payments
- memberships
- packages
- subscriptions
- participant accounts/portal
- QR check-in
- native mobile apps
- advanced analytics
- marketing campaigns
- referral tracking
- surveys
- digital waiver platform

## Explicit non-goals
The MVP is not a gym membership platform, payment processor, health record, or marketing automation suite.

## Approved post-MVP Phase 7 extension

Per DEC-047, the next engineering phase is Event Publishing, Registration Links, QR Distribution & Admin Invitations. It is not part of the original frozen MVP. Planned scope includes canonical event URLs, safe stable slugs, publication/unpublication, registration opening/closing and pause/resume, public availability states, link copy/preview, QR generation, and System Admin invitation-link lifecycle.

The application remains the registration system. A venue administrator may eventually distribute the canonical participant URL through text, email, WhatsApp, newsletters, websites, social media, or printed QR codes; the application does not automate those channels. External form builders are not part of the approved architecture.

Phase 7 remains subject to the provisional Participation acknowledgment legal gate, adds no production authorization, and does not include automated messages, participant accounts/login, participant merging, analytics or tracking/QR analytics, payments, deployment, legal approval, or Phase 8 work. Phase 7 implementation is pending and all related validation is planned rather than complete.
