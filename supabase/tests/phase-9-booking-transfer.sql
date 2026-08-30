-- Same-series participant booking transfer acceptance boundary.
\set ON_ERROR_STOP on
begin;

do $$
declare
  admin_id uuid := '79000000-0000-0000-0000-000000000001';
  organization_id uuid := '79000000-0000-0000-0000-000000000002';
  venue_id uuid := '79000000-0000-0000-0000-000000000003';
  series_id uuid := '79000000-0000-0000-0000-000000000004';
  other_series_id uuid := '79000000-0000-0000-0000-000000000005';
  participant_key uuid := '79000000-0000-0000-0000-000000000006';
  full_participant_id uuid := '79000000-0000-0000-0000-000000000007';
  group_id uuid := '79000000-0000-0000-0000-000000000008';
  full_group_id uuid := '79000000-0000-0000-0000-000000000009';
  expired_group_id uuid := '79000000-0000-0000-0000-000000000027';
  source_id uuid := '79000000-0000-0000-0000-000000000010';
  target_id uuid := '79000000-0000-0000-0000-000000000011';
  cross_source_id uuid := '79000000-0000-0000-0000-000000000012';
  cross_target_id uuid := '79000000-0000-0000-0000-000000000013';
  full_source_id uuid := '79000000-0000-0000-0000-000000000014';
  full_target_id uuid := '79000000-0000-0000-0000-000000000015';
  closed_source_id uuid := '79000000-0000-0000-0000-000000000016';
  closed_target_id uuid := '79000000-0000-0000-0000-000000000017';
  not_open_source_id uuid := '79000000-0000-0000-0000-000000000018';
  not_open_target_id uuid := '79000000-0000-0000-0000-000000000019';
  close_source_id uuid := '79000000-0000-0000-0000-000000000020';
  close_target_id uuid := '79000000-0000-0000-0000-000000000021';
  deadline_source_id uuid := '79000000-0000-0000-0000-000000000022';
  deadline_target_id uuid := '79000000-0000-0000-0000-000000000023';
  token text := repeat('t', 32);
  confirmation_token text := repeat('c', 40);
  expired_confirmation_token text := repeat('e', 40);
  result jsonb;
  alternatives jsonb;
  new_registration_id uuid;
begin
  insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (admin_id, 'authenticated', 'authenticated', 'phase9-transfer@example.test', now(), now(), now());
  insert into public.admin_profiles (id, display_name, email, role, status)
  values (admin_id, 'Phase 9 Transfer Admin', 'phase9-transfer@example.test', 'SYSTEM_ADMIN', 'ACTIVE');
  insert into public.organizations (id, name)
  values (organization_id, 'Phase 9 Transfer Organization');
  insert into public.venues (id, organization_id, name, street, city, state, postal_code)
  values (venue_id, organization_id, 'Phase 9 Transfer Studio', '1 Transfer Street', 'Albany', 'NY', '12207');
  insert into public.event_series (id, frequency, interval_count, ends_on, selection_window_days, created_by_admin_id)
  values (series_id, 'WEEKLY', 1, current_date + 30, 14, admin_id),
         (other_series_id, 'WEEKLY', 1, current_date + 30, 14, admin_id);
  insert into public.acknowledgment_versions (id, type, version, exact_text, content_hash, effective_at, legal_status, created_by_admin_id)
  values
    ('79000000-0000-0000-0000-000000000024', 'PARTICIPATION_RISK', 7901, 'Synthetic transfer participation acknowledgment.', decode(repeat('aa', 32), 'hex'), now(), 'PROVISIONAL', admin_id),
    ('79000000-0000-0000-0000-000000000025', 'DATA_USE', 7901, 'Synthetic transfer data-use acknowledgment.', decode(repeat('bb', 32), 'hex'), now(), 'APPROVED', admin_id);
  insert into public.participants (id, first_name, last_name, normalized_first_name, normalized_last_name, display_phone, normalized_phone, phone_country)
  values
    (participant_key, 'Transfer', 'Participant', 'transfer', 'participant', '+15185550101', '+15185550101', 'US'),
    (full_participant_id, 'Full', 'Participant', 'full', 'participant', '+15185550102', '+15185550102', 'US');
  insert into public.registration_groups (id, participant_id, submission_source, participation_acknowledgment_version_id, participation_acknowledged_at, data_use_acknowledgment_version_id, data_use_acknowledged_at)
  values
    (group_id, participant_key, 'PUBLIC', '79000000-0000-0000-0000-000000000024', now(), '79000000-0000-0000-0000-000000000025', now()),
    (full_group_id, full_participant_id, 'PUBLIC', '79000000-0000-0000-0000-000000000024', now(), '79000000-0000-0000-0000-000000000025', now()),
    (expired_group_id, participant_key, 'PUBLIC', '79000000-0000-0000-0000-000000000024', now(), '79000000-0000-0000-0000-000000000025', now());
  insert into public.participant_remembered_devices (participant_id, token_hash, expires_at)
  values (participant_key, digest(token, 'sha256'), now() + interval '1 day');

  insert into public.events (id, host_organization_id, venue_id, name, starts_at, ends_at, timezone, capacity, registration_deadline, status, visibility, publication_status, registration_opens_at, registration_closes_at, created_by_admin_id, event_series_id, series_occurrence_number)
  values
    (source_id, organization_id, venue_id, 'Transfer source', now() + interval '2 days', now() + interval '2 days 1 hour', 'America/New_York', 10, now() + interval '1 day', 'OPEN', 'PUBLIC', 'PUBLISHED', null, null, admin_id, series_id, 1),
    (target_id, organization_id, venue_id, 'Transfer target', now() + interval '3 days', now() + interval '3 days 1 hour', 'America/New_York', 10, now() + interval '2 days', 'OPEN', 'PUBLIC', 'PUBLISHED', null, null, admin_id, series_id, 2),
    (cross_source_id, organization_id, venue_id, 'Cross-series source', now() + interval '2 days', now() + interval '2 days 1 hour', 'America/New_York', 10, now() + interval '1 day', 'OPEN', 'PUBLIC', 'PUBLISHED', null, null, admin_id, series_id, 3),
    (cross_target_id, organization_id, venue_id, 'Cross-series target', now() + interval '3 days', now() + interval '3 days 1 hour', 'America/New_York', 10, now() + interval '2 days', 'OPEN', 'PUBLIC', 'PUBLISHED', null, null, admin_id, other_series_id, 1),
    (full_source_id, organization_id, venue_id, 'Full source', now() + interval '2 days', now() + interval '2 days 1 hour', 'America/New_York', 10, now() + interval '1 day', 'OPEN', 'PUBLIC', 'PUBLISHED', null, null, admin_id, series_id, 4),
    (full_target_id, organization_id, venue_id, 'Full target', now() + interval '3 days', now() + interval '3 days 1 hour', 'America/New_York', 1, now() + interval '2 days', 'OPEN', 'PUBLIC', 'PUBLISHED', null, null, admin_id, series_id, 5),
    (closed_source_id, organization_id, venue_id, 'Closed source', now() + interval '2 days', now() + interval '2 days 1 hour', 'America/New_York', 10, now() + interval '1 day', 'OPEN', 'PUBLIC', 'PUBLISHED', null, null, admin_id, series_id, 6),
    (closed_target_id, organization_id, venue_id, 'Closed target', now() + interval '3 days', now() + interval '3 days 1 hour', 'America/New_York', 10, now() + interval '2 days', 'CLOSED', 'PUBLIC', 'PUBLISHED', null, null, admin_id, series_id, 7),
    (not_open_source_id, organization_id, venue_id, 'Not open source', now() + interval '2 days', now() + interval '2 days 1 hour', 'America/New_York', 10, now() + interval '1 day', 'OPEN', 'PUBLIC', 'PUBLISHED', null, null, admin_id, series_id, 8),
    (not_open_target_id, organization_id, venue_id, 'Not open target', now() + interval '3 days', now() + interval '3 days 1 hour', 'America/New_York', 10, now() + interval '2 days', 'OPEN', 'PUBLIC', 'PUBLISHED', now() + interval '1 hour', null, admin_id, series_id, 9),
    (close_source_id, organization_id, venue_id, 'Close source', now() + interval '2 days', now() + interval '2 days 1 hour', 'America/New_York', 10, now() + interval '1 day', 'OPEN', 'PUBLIC', 'PUBLISHED', null, null, admin_id, series_id, 10),
    (close_target_id, organization_id, venue_id, 'Close target', now() + interval '3 days', now() + interval '3 days 1 hour', 'America/New_York', 10, now() + interval '2 days', 'OPEN', 'PUBLIC', 'PUBLISHED', null, now() - interval '1 hour', admin_id, series_id, 11),
    (deadline_source_id, organization_id, venue_id, 'Deadline source', now() + interval '2 days', now() + interval '2 days 1 hour', 'America/New_York', 10, now() + interval '1 day', 'OPEN', 'PUBLIC', 'PUBLISHED', null, null, admin_id, series_id, 12),
    (deadline_target_id, organization_id, venue_id, 'Deadline target', now() + interval '3 days', now() + interval '3 days 1 hour', 'America/New_York', 10, now() - interval '1 hour', 'OPEN', 'PUBLIC', 'PUBLISHED', null, null, admin_id, series_id, 13);
  insert into public.registrations (id, registration_group_id, participant_id, event_id)
  values
    (source_id, group_id, participant_key, source_id),
    (cross_source_id, group_id, participant_key, cross_source_id),
    (full_source_id, group_id, participant_key, full_source_id),
    (closed_source_id, group_id, participant_key, closed_source_id),
    (not_open_source_id, group_id, participant_key, not_open_source_id),
    (close_source_id, group_id, participant_key, close_source_id),
    (deadline_source_id, group_id, participant_key, deadline_source_id),
    ('79000000-0000-0000-0000-000000000026', full_group_id, full_participant_id, full_target_id);
  insert into public.registration_group_results (registration_group_id, event_id, success, reason, registration_id)
  values (group_id, source_id, true, null, source_id);
  insert into public.confirmation_tokens (registration_group_id, token_hash, expires_at)
  values
    (group_id, digest(confirmation_token, 'sha256'), now() + interval '1 day'),
    (expired_group_id, digest(expired_confirmation_token, 'sha256'), now() - interval '1 hour');

  begin
    perform public.manage_participant_booking(repeat('x', 32), 'TRANSFER', source_id, target_id);
    raise exception 'invalid token was accepted';
  exception when others then
    if sqlerrm <> 'booking access is invalid' then raise; end if;
  end;

  begin
    perform public.manage_participant_booking(expired_confirmation_token, 'TRANSFER', source_id, target_id);
    raise exception 'expired confirmation token was accepted';
  exception when others then
    if sqlerrm <> 'booking access is invalid' then raise; end if;
  end;

  alternatives := public.get_participant_booking_alternatives(confirmation_token, source_id);
  if jsonb_array_length(alternatives) <> 1 or not (alternatives @> jsonb_build_array(jsonb_build_object('event_id', target_id))) then
    raise exception 'destination eligibility filter returned an incorrect set: %', alternatives;
  end if;

  result := public.manage_participant_booking(confirmation_token, 'TRANSFER', source_id, target_id);
  if result->>'status' <> 'TRANSFERRED' or result->>'idempotent' <> 'false' then
    raise exception 'initial transfer result was incorrect: %', result;
  end if;
  new_registration_id := (result->>'registration_id')::uuid;
  if (select registration_status from public.registrations where id = source_id) <> 'CANCELLED'
     or (select registration_outcome from public.registrations where id = source_id) <> 'PARTICIPANT_CANCELLED'
     or (select count(*) from public.registrations r where r.participant_id = participant_key and r.event_id = target_id and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE') <> 1 then
    raise exception 'transfer did not atomically replace the source booking';
  end if;
  if not exists (
    select 1 from public.participant_booking_audits a
    where a.registration_id = source_id and a.action = 'TRANSFERRED' and a.result = 'SUCCESS'
      and a.target_event_id = target_id
      and a.metadata->>'source_registration_id' = source_id::text
      and a.metadata->>'destination_registration_id' = new_registration_id::text
  ) then
    raise exception 'transfer provenance audit is missing';
  end if;

  result := public.manage_participant_booking(confirmation_token, 'TRANSFER', source_id, target_id);
  if result->>'status' <> 'TRANSFERRED' or result->>'idempotent' <> 'true' or (result->>'registration_id')::uuid <> new_registration_id then
    raise exception 'transfer replay was not idempotent: %', result;
  end if;
  if (select count(*) from public.registrations r where r.participant_id = participant_key and r.event_id = target_id and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE') <> 1
     or (select count(*) from public.participant_booking_audits a where a.registration_id = source_id and a.target_event_id = target_id and a.action = 'TRANSFERRED' and a.result = 'SUCCESS') <> 1 then
    raise exception 'transfer replay created duplicate state';
  end if;

  begin
    perform public.manage_participant_booking(token, 'TRANSFER', cross_source_id, cross_target_id);
    raise exception 'cross-series transfer was accepted';
  exception when others then
    if sqlerrm <> 'alternative occurrence is unavailable' then raise; end if;
  end;
  begin
    perform public.manage_participant_booking(token, 'TRANSFER', full_source_id, full_target_id);
    raise exception 'full destination was accepted';
  exception when others then
    if sqlerrm <> 'alternative occurrence is full' then raise; end if;
  end;
  begin
    perform public.manage_participant_booking(token, 'TRANSFER', closed_source_id, closed_target_id);
    raise exception 'closed destination was accepted';
  exception when others then
    if sqlerrm <> 'alternative occurrence is unavailable' then raise; end if;
  end;
  begin
    perform public.manage_participant_booking(token, 'TRANSFER', not_open_source_id, not_open_target_id);
    raise exception 'not-yet-open destination was accepted';
  exception when others then
    if sqlerrm <> 'alternative occurrence is unavailable' then raise; end if;
  end;
  begin
    perform public.manage_participant_booking(token, 'TRANSFER', close_source_id, close_target_id);
    raise exception 'closed-window destination was accepted';
  exception when others then
    if sqlerrm <> 'alternative occurrence is unavailable' then raise; end if;
  end;
  begin
    perform public.manage_participant_booking(token, 'TRANSFER', deadline_source_id, deadline_target_id);
    raise exception 'expired-deadline destination was accepted';
  exception when others then
    if sqlerrm <> 'alternative occurrence is unavailable' then raise; end if;
  end;

  if (select count(*) from public.registrations r where r.participant_id = participant_key and r.event_id in (cross_source_id, full_source_id, closed_source_id, not_open_source_id, close_source_id, deadline_source_id) and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE') <> 6 then
    raise exception 'a rejected transfer changed a source booking';
  end if;
end;
$$;

rollback;
