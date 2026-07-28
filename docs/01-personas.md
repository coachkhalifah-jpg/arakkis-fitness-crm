# 01 — Personas

## Participant

### Description
An adult community member who registers primarily on a mobile phone. The participant may be affiliated with one institution but attend events hosted elsewhere.

### Goals
- See upcoming eligible dates.
- Select one or several sessions.
- Complete one short form.
- Reserve available spots.
- Receive clear registration results.
- Add successful registrations to a calendar.
- Optionally opt in to receive an event's WhatsApp invitation link after reviewing the privacy disclosure.
- Receive a secure confirmation link that shows only the submission's results and calendar links.

### Constraints
- Should not need an account.
- Should not repeat contact information for every selected date.
- Should understand partial success when one selected event is full or closed.

---

## Coach / System Administrator

### Description
The product owner and global operator.

### Goals
- Create and manage organizations, venues, and events.
- View all events and participant histories.
- See first-time and returning indicators.
- Manage registration, attendance, walk-ins, and corrections.
- Review and complete follow-up tasks.
- Review Host Admin cancellation requests, cancel events, and manage cancellation notification tasks.
- Optionally store event WhatsApp invitation links and copy invitation messages.
- Review possible duplicate participant cases and merge records when authorized.
- Manage administrator invitations and organization assignments.
- Create and manage host administrators.

### Access
Global access across all organizations.

---

## Host Administrator

### Description
A trusted representative of a host institution or event space.

### Goals
- View events hosted by assigned organizations.
- View event-specific rosters.
- Add participants or walk-ins.
- Update registrations and attendance.
- Correct event-specific attendance errors.
- Export authorized event rosters where allowed.
- Submit cancellation requests for events hosted by assigned organizations.
- View event cancellation state and event-scoped WhatsApp opt-in/sent status.
- Export opted-in WhatsApp participants only for authorized events.
- Submit individual attendance corrections but cannot reopen an entire finalized event.

### Restrictions
- No global participant directory.
- No unrelated organization events.
- No cross-location attendance history.
- No global follow-up queue.
- No global settings or user management.
- No private coach notes unrelated to their events.
- Cannot directly cancel events; cancelled events cannot be restored in MVP.
- Cannot view or export WhatsApp data for unrelated events.
- Cannot view, edit, copy, complete, or dismiss global participant follow-up tasks.
- Cannot merge Participant records.
