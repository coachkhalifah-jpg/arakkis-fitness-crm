# Community Touchpoints — Canonical Copy Guide

This guide applies to Community Touchpoints and all related implementation slices. It defines presentation vocabulary and tone only. It does not create new trigger logic, authorization, persistence, or automated messaging behavior.

## Voice

Write from the perspective of one coach working across multiple Organizations and Venues. Copy is personal but not overly familiar, observant rather than automated, encouraging rather than motivational or sales-oriented, neutral across venue types, focused on meaningful moments, and optional and coach-controlled.

Do not use gym-owned language, shame, guilt, pressure, participant scores, rankings, risk labels, engagement scores, corporate CRM language, or language implying that a message was sent automatically.

## Canonical vocabulary

| Old term | Canonical term |
| --- | --- |
| Participants | People |
| Follow-Up / follow-up task | Touchpoint |
| Group Chat | Group |
| Suggested message | Suggested note |
| Complete | Mark done |
| Welcome Note Sent | Welcome Message Sent |
| Relationship queue / Needs attention | Worth noticing |
| Member | Person or attendee, only where needed |
| Retention outreach | Touch Base |
| Low attendance | Upcoming class conversation |
| Open participant | View person |
| View event | View Event |
| Copy message | Copy note |

Never use: At risk, Inactive, Recovery campaign, Reactivation, Win back, Retention score, Engagement probability, Contact priority, Risk level, Automation rule, or Campaign stage.

## Page vocabulary

Header:

```text
SYSTEM ADMIN / COMMUNITY
NOTICE THE
MOMENT.

COACH-LED TOUCHPOINTS
Arakkis notices. You decide what feels useful.
```

Primary navigation: `1-1` and `Group`.

Summary metrics: `WORTH NOTICING TODAY`, `OPEN TOUCHPOINTS`, `COMPLETED`.

Status controls: `STATUS`, `Open`, `Completed`, `Dismissed`, `All`.

Category controls: `SHOW`, `Worth noticing`, `Celebrate`, `Touch Base`, `Community`.

Queue heading:

```text
WORTH NOTICING / 1-1
[X] MOMENT(S)
Small actions, meaningful moments
```

## Touchpoint labels

Use these labels where the corresponding projection exists:

- First Class — `Celebrate`
- First No-Show — `Touch Base`
- Consistency Streak — `Celebrate`
- First Class After Absence — `Celebrate`
- Welcome Message Sent — `Celebrate`

Each detail should explain why the moment is surfaced without labeling the person. Use `EVENT`, `UPCOMING BOOKING`, and `OUTREACH RHYTHM` as context labels. Use `COACH` instead of `Assigned` where a coach is displayed.

## Suggested notes

Use `SUGGESTED NOTE`, `Edit`, `Save`, and `Copy note`. A note is editable, optional, short, natural-language, coach-controlled, and never automatically sent.

## Actions and outcomes

Use: `Call`, `Snooze`, `Mark done`, `Dismiss`, `Edit`, `Save`, `Copy note`, `Send message`, `View person`, `View Event`, and `Open group activity`.

Mark-done prompt:

```text
WHAT HAPPENED?
Sent a welcome note
Offered a next class
Checked in by phone
No response yet
```

Dismiss prompt:

```text
DISMISS BECAUSE
No longer relevant
Already addressed
Person requested no outreach
```

## Outreach rhythm

Use:

- No previous outreach
- No outreach in the last 14 days
- No recent celebration
- Return resets the tone
- Cooling off until the next meaningful moment

Do not expose internal cooldown, score, priority, or automation terminology.

## Empty and feedback states

Empty 1-1:

```text
No moments here right now
Try another view. A quiet list is useful too.
```

Empty Group:

```text
No group moments need attention
When a shared practice needs a thoughtful touch,
activity will appear here.
```

Feedback:

- `Suggested note saved to this touchpoint.`
- `Suggested note copied.`
- `[Person]'s touchpoint was snoozed until next week.`
- `Message action prepared for [Person].`
- `[Person]'s touchpoint was completed: [outcome].`
- `[Person]'s touchpoint was dismissed: [reason].`
- `[Action] is prepared for [Group].`

## Product model

```text
Arakkis notices
→ explains the moment
→ suggests a human action
→ coach decides
→ coach may send, mark done, snooze, or dismiss
```

A Touchpoint is not automatically a problem, required task, judgment, message, score, or participant-visible classification.

## Approved Slice 1 rule: New Class

`New Class` uses a seven-day lookback window measured from the Event's first publication or public availability, never from draft creation.

For recurring Events, evaluate the series launch once rather than treating each generated occurrence as a new class. Republishing an already-launched class does not reset the window by default.

Access-restricted Events may produce a coach-facing `New Class` Touchpoint. Any suggested note or outreach must respect the Event's existing access scope and must not broaden participant visibility or eligibility.
