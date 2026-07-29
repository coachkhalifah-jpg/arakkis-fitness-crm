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

## Phase 4B browser validation and fixture recovery

The first clean-reset browser run reproduced the Phase 2 fixture failure. The Playwright process supplied the local Supabase URL and keys but not the required server-side `APP_ENV`. Invitation acceptance calls the server-only environment parser, so the missing value caused a validation exception and Next's generic error page. Sign-in-only tests passed because they did not read the server environment. `playwright.config.ts` now forces `APP_ENV=test` for the application web server.

Browser fixtures are local-only and synthetic. Each authentication/registration spec creates fresh Auth identities through the local Auth Admin API, inserts matching application rows using the returned Auth UUIDs, assigns organizations explicitly, and uses a fresh browser context. No stored session, password, raw invitation token, or confirmation token is committed or reused across database resets. The Phase 4 fixture creates active organizations, venues, published future events, a full event, a draft event, and synthetic acknowledgment versions with generated identifiers.

The public browser slice exercises the real registration server action/RPC: two-date success, venue-local display, confirmation-token routing, Google Calendar links, multi-event ICS export, database persistence, Host Admin roster visibility, exact normalized participant reuse, protected participant-field preservation, and altered-token rejection. ICS assertions verify CRLF output, event count, successful-event inclusion, and absence of participant email. Existing Phase 2 browser coverage passes all five tests, and existing Phase 3 browser coverage passes all six tests, including organization scope, direct denial, capacity floor, and venue-timezone persistence.

During this pass, public registration exposed a genuine control-flow defect: `submitRegistration` caught Next's thrown redirect and returned the generic registration error after a successful RPC. The redirect now occurs after the validation/error boundary, preserving confirmation navigation.

Validation completed includes clean local reset/migration cycles, Phase 1/2 database runtime assertions, schema lint with no errors, 16 unit/component tests, strict TypeScript, ESLint, formatting, and the Phase 2/3/smoke browser suite. No Phase 5 functionality was added.

## Phase 4C concurrency and confirmation security validation

The authoritative registration boundary is the public `register_selected_events` security-definer RPC invoked by `submitRegistration`. Within one transaction it validates acknowledgment versions, eligibility, and event availability; serializes exact participant matching with a transaction-scoped advisory lock; creates the Registration Group and immutable acknowledgment evidence; locks each selected Event row with `FOR UPDATE`; independently counts active registrations; creates only successful individual Registrations; records every selected-event result; and creates one hash-only confirmation token. The event row lock is the capacity boundary: the second transaction observes the committed count and returns the safe `FULL` result without exposing SQL or lock details.

The final-spot browser release test uses the public RPC with two barrier-synchronized anonymous requests and a dynamically generated local fixture containing an active organization, venue, future published event, provisional/approved synthetic acknowledgments, capacity two, and one existing active Registration. It runs three isolated repetitions. Every repetition persisted exactly two active registrations (one prefilled plus one winner), exactly one winner and one `FULL` result, two synthetic participants, two acknowledgment acceptances, one successful Registration, one failed-attempt group with no Registration, and one hash-only usable confirmation token. No active count exceeded capacity and no orphan individual Registration was created.

Migration `0016_confirmation_success_scope.sql` is the only Phase 4C migration. It preserves migrations `0001–0015` and makes a confirmation bearer invalid unless its scoped Registration Group contains at least one successful result. This prevents an all-full submission from receiving usable confirmation or calendar access while preserving partial-success confirmations. Confirmation tests cover valid access, replay before expiration, malformed, random, altered, empty, missing, whitespace-only, overlong, URL-encoded malformed, unexpected-Unicode, expired, and cross-group tokens. They compare safe generic page behavior and 404 ICS behavior, verify client-supplied group/registration identifiers are ignored, verify group isolation, and verify no raw token/hash appears in ICS, Google Calendar URLs, cookies, local storage, session storage, or database rows (the raw token is intentionally present only transiently in the bearer URL and generated confirmation links needed to access the read-only export).

The ICS matrix uses the same token RPC and rejects every invalid/expired token without event data. Valid ICS responses are `text/calendar`, use the safe filename `fitness-events.ics`, contain only scoped successful `VEVENT` entries, and contain no participant email, raw token, token hash, or internal credential. Public errors remain generic (`Confirmation unavailable`, `invalid or expired` UI) and never expose participant existence, SQL/RPC/table names, counts, hashes, stack traces, or lock errors.
