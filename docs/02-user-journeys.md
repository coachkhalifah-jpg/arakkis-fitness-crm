# 02 — User Journeys

## Journey 1 — Participant multi-date registration

1. Participant opens the public event schedule or shared campaign link.
2. System shows open upcoming events with:
   - event name
   - date and time
   - host organization
   - venue
   - available-space state
3. Participant selects one or more dates.
4. Participant completes contact and affiliation information once.
5. Participant reviews selected dates.
6. System validates each selected event independently:
   - status
   - deadline
   - capacity
   - duplicate registration
   - affiliation restriction
7. System creates one Registration Group for the submission.
8. System creates a separate Registration for every successful event.
9. Confirmation shows successful and unsuccessful selections separately.
10. Participant can:
   - add each successful event to Google Calendar
   - download each event as `.ics`
   - download all successful events in one `.ics`
11. Participant may optionally opt in to receive the event's WhatsApp invitation link after seeing the disclosure that joining can expose their WhatsApp profile name and phone number to group members. Registration remains valid without opting in.
12. Participant receives a read-only opaque confirmation token immediately; it expires after 24 hours and does not authenticate the participant or expose participant history.

## Journey 2 — Coach prepares for an event

1. Coach opens Dashboard.
2. Coach sees the next event, registrations, capacity, first-time-with-coach count, first-time-at-host count, and follow-ups due.
3. Coach opens the event roster.
4. Coach reviews participant name, contact information, affiliation, registration status, and history indicators.
5. Coach optionally adds a manually registered participant or walk-in.
6. Coach exports the roster if needed.

## Journey 3 — Host prepares for an event

1. Host Admin signs in.
2. Dashboard displays only events hosted by assigned organizations.
3. Host opens an authorized event.
4. Host sees the event roster and event-specific participant information.
5. Host cannot access unrelated event URLs or global participant history.

## Journey 4 — Check-in and attendance finalization

1. Authorized admin opens event check-in.
2. Admin marks arriving participants Attended.
3. Admin may add a walk-in by matching or creating a participant.
4. At event end, admin selects Finalize Attendance.
5. System warns about unchecked active registrations.
6. On confirmation:
   - checked-in registrations remain Attended
   - cancelled registrations remain Cancelled
   - remaining active registrations become No-Show
7. Authorized admin may later correct an attendance error.

## Journey 7 — Event cancellation

1. Host Admin may submit a cancellation request for an event hosted by an assigned organization, including reason and cancellation type.
2. The request is PENDING; the submitting Host Admin may withdraw it while pending.
3. System Admin approves or rejects the request; rejection requires a reason, and only APPROVED triggers cancellation. All decisions remain audited.
4. System Admin selects Permanent, Rescheduling Planned, or Replacement Date to Be Announced, enters a reason, and explicitly confirms.
5. On cancellation, the system immediately rejects new registrations, preserves the event and registration history, disables check-in and attendance finalization, marks affected active registrations with an explicit `EVENT_CANCELLED` outcome, and creates one participant-notification task per affected participant.
6. Cancelled events never convert registrations to No-Show and do not count negatively against participants.
7. The cancelled event remains permanently CANCELLED; its EVENT_CANCELLED outcomes and history remain and registration/attendance do not reopen.
8. For rescheduling, System Admin copies the cancelled event into a new Draft Event, assigns the new date/time, opens registration, and invites affected participants to register; registrations and attendance are not transferred automatically.

## Journey 7A — Cancellation notification operations

1. Cancellation immediately creates one HIGH-priority participant-notification task per affected participant with created_at and due_at equal to the cancellation timestamp.
2. The task displays the Event start time and time remaining.
3. The system selects an editable default template for Permanent, Replacement Date to Be Announced, or Replacement Event Available.
4. Assigned Host Admins may update individual affected Registration delivery statuses, channel, sent time, and delivery note, but cannot complete or dismiss the overall task.
5. Only System Admin may complete or dismiss the overall task after confirming the notification process is complete.

## Journey 8 — Optional WhatsApp event group

1. System Admin optionally stores a WhatsApp group invitation link on an event and uses the generated copyable invitation message.
2. Participant may opt in during registration after seeing the disclosure about exposure of WhatsApp profile name and phone number to group members.
3. Registration succeeds whether or not the participant opts in.
4. Event roster shows WhatsApp opt-in and invitation-sent status.
5. Authorized administrators export only opted-in participants for that event; Host Admin scope remains organization/event restricted.
6. No participant is automatically added to a WhatsApp group. Direct WhatsApp Groups API integration is Phase 2.

## Journey 5 — Post-event follow-up

1. Attendance is finalized.
2. System evaluates follow-up triggers idempotently.
3. A participant's first-ever attendance creates one First Attendance task due 24 hours after event end.
4. Each finalized No-Show creates exactly one pending no-show follow-up task.
5. Coach opens Follow-Ups.
6. Coach reviews and edits the suggested message.
7. Coach copies and sends it externally.
8. Coach marks the task Completed or Dismissed.
9. Task remains in participant history.

## Journey 6 — Cross-location participation

1. John Doe's primary affiliation is ABC Mosque.
2. John registers for an event hosted by XYZ Community Center.
3. John remains one global Participant.
4. The Registration stores ABC Mosque as his affiliation at registration.
5. System Admin sees John's complete coach history.
6. XYZ Host Admin sees John only in the context of XYZ-hosted events.

## Journey 9 — Participant matching and duplicate review

1. System normalizes first name, last name, phone, and email.
2. Public/admin registration automatically matches an existing Participant only when normalized E.164 phone, normalized first name, and normalized last name all match.
3. Phone-only, email-only, name-only, or conflicting matches do not merge automatically; ambiguous cases become possible-duplicate cases for System Admin review.
4. System Admin may manually merge records by selecting a survivor, migrating registrations/attendance/follow-ups/notes/history, preserving audit data, preventing duplicate active registrations, and archiving the duplicate.
5. Host Admin cannot merge Participants.

## Journey 10 — Attendance lifecycle

1. Authorized admin opens an event's attendance state from NOT_STARTED to OPEN.
2. Admin checks in participants and may finalize attendance.
3. Finalization records actor/time, preserves Attended and participant-cancelled registrations, converts unchecked active registrations to No-Show, and runs triggers idempotently.
4. Authorized admin may correct an individual attendance with reason and audit metadata.
5. Only System Admin may reopen the entire finalized event. Reopening requires a reason, preserves current statuses until corrected, and requires re-finalization.

## Journey 11 — Administrator invitation

1. Public administrator signup is unavailable.
2. The initial System Admin is securely provisioned during deployment.
3. System Admin invites a Host Admin using required email and organization assignments.
4. The invitation is PENDING, uses a hashed single-use token expiring after 72 hours, and becomes ACTIVE only after acceptance.
5. System Admin may resend, revoke, suspend, reactivate, or change assignments; production has no default passwords.
