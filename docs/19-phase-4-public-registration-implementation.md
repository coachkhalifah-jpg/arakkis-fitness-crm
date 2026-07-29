# Phase 4 — Public Registration, Participant Matching & Calendar Export

## Scope and requirements

This implementation covers FR-006–FR-014, FR-018, FR-024, FR-051–FR-053, FR-059–FR-062, BR-001–BR-023, BR-052, BR-070–BR-075, and AT-001–AT-006, AT-023–AT-026, AT-029, AT-032–AT-033, AT-054–AT-062, and AT-090–AT-095. Attendance, CRM editing, merging, follow-up, messaging delivery, and Phase 5 functionality remain deferred.

## Architecture

- `/registration` is the public schedule and multi-date form.
- `/registration/confirmation?token=...` is a read-only, token-scoped result page.
- `/registration/confirmation/ics?token=...` returns an authorized multi-event iCalendar file.
- `/admin/events/[id]` includes the minimum authenticated roster view. Existing server authorization and RLS limit Host Admins to assigned organizations.
- Public writes use the existing anonymous `register_selected_events` RPC through the anonymous Supabase client. The browser never writes participant or registration tables directly.
- Public reads use the narrow `public_event_schedule` view and token-scoped `get_registration_confirmation` RPC. Anonymous direct table reads remain denied.

## Eligibility and transaction behavior

The schedule and RPC require an upcoming `OPEN` event whose deadline has not passed, whose host organization and venue are active, and whose event is not archived. Affiliation-restricted events additionally require an active selected organization in the event eligibility set. The RPC rechecks every selected event while holding its event row lock.

One registration group and acknowledgment evidence are created for the submission. Each selected event is processed independently, creating one registration for each successful event. Duplicate selections are removed before processing. Successful event rows remain committed if another selected event is full, closed, ineligible, or duplicated. The database capacity trigger and event row lock protect the final spot under concurrent requests; the unique active registration index prevents duplicates.

## Participant fields and normalization

The form collects first name, last name, required mobile phone, optional email, primary affiliation or Other/No affiliation, optional fitness experience, optional note, and separate Participation and Data Use acknowledgments. Phone parsing uses `libphonenumber-js` with US as the explicit default and stores display phone, E.164 phone, and country. Names are trimmed, whitespace-collapsed, Unicode-NFKC normalized, and case-folded for matching while display names are preserved. Email is trimmed, lowercased, and basic-format validated. Email never independently merges participants.

Automatic matching requires exact normalized E.164 phone, normalized first name, and normalized last name. Phone-only, name-only, email-only, and fuzzy matches do not merge. An ambiguous exact match fails safely. A matched participant receives only approved public-contact/profile updates; protected status, history, notes, and administrative fields are never overwritten. Affiliation at registration is stored separately from event host organization.

## Acknowledgments and confirmation

The RPC resolves only the active Participation Risk and Data Use version supplied by the server; arbitrary client-selected versions are rejected. Local development may use PROVISIONAL synthetic acknowledgment records. Production remains blocked until Participation Risk is APPROVED. Confirmation tokens are 256-bit URL-safe random values, stored only as SHA-256 hashes, scoped to one registration group, reusable read-only for 24 hours, and never logged or placed in browser storage. Token-scoped RPCs return only that group’s results.

## Calendar export

The confirmation page provides one Google Calendar link per successful event and one multi-event `.ics` export. ICS output uses CRLF line endings, escaped text, stable event UIDs, UTC timestamps, and the event’s venue-local timezone as the display authority. Failed events are never exported.

## Authorization, RLS, audit, and service boundaries

Anonymous users can read only the schedule view and execute the registration/confirmation RPCs. Authenticated admins use the existing RLS-backed Supabase server client for roster reads; System Admins are global and Host Admins are organization-scoped. No service-role client is used for Phase 4 public registration. Registration groups, participant matches/creates, registrations, and acknowledgment acceptances are transactionally written by the RPC; raw confirmation tokens are absent from database and audit records.

## Testing and local setup

Unit tests cover normalization, validation, Google Calendar URL construction, and ICS escaping. Database assertions and runtime tests cover public projection filters, RPC grants, token hash-only storage, eligibility, duplicate prevention, and capacity locking. Playwright uses local Supabase and synthetic identities only for public registration and authorized roster flows. Run `supabase start`, the project-scoped reset validation script when required, `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`.

## Known limitations and deferred functionality

The local schema has no production-approved Participation Risk acknowledgment yet, so local tests use clearly synthetic PROVISIONAL content and production deployment remains blocked. Anonymous rate limiting and bot protection are deployment hooks rather than local infrastructure. Participant self-cancellation, attendance, CRM editing, merging, follow-up tasks, email/SMS/WhatsApp delivery, analytics, payments, and Phase 5 functionality are explicitly deferred.
