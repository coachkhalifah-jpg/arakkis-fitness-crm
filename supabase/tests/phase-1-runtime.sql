-- Phase 1D live runtime tests.
-- Execute as the local Postgres superuser in a disposable database:
--   docker exec -i <supabase-db-container> psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f - < this-file

\set ON_ERROR_STOP on
begin;

-- Disposable Auth identities and database fixtures.
insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'system@example.test', now(), now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'host-a@example.test', now(), now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'host-b@example.test', now(), now(), now()),
  ('10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'system-2@example.test', now(), now(), now());

insert into public.admin_profiles (id, display_name, email, role, status)
values
  ('10000000-0000-0000-0000-000000000001', 'Runtime System Admin', 'system@example.test', 'SYSTEM_ADMIN', 'ACTIVE'),
  ('10000000-0000-0000-0000-000000000002', 'Runtime Host Admin A', 'host-a@example.test', 'HOST_ADMIN', 'PENDING'),
  ('10000000-0000-0000-0000-000000000003', 'Runtime Host Admin B', 'host-b@example.test', 'HOST_ADMIN', 'PENDING'),
  ('10000000-0000-0000-0000-000000000004', 'Runtime Second System Admin', 'system-2@example.test', 'SYSTEM_ADMIN', 'ACTIVE');

insert into public.organizations (id, name)
values
  ('20000000-0000-0000-0000-000000000001', 'Runtime Organization A'),
  ('20000000-0000-0000-0000-000000000002', 'Runtime Organization B');

insert into public.admin_organization_assignments (admin_profile_id, organization_id, created_by_admin_id)
values
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001');

update public.admin_profiles set status = 'ACTIVE'
where id in ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003');

insert into public.venues (id, organization_id, name, street, city, state, postal_code, timezone)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Runtime Venue A', '1 Test Street', 'Test City', 'NY', '10001', 'America/New_York'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Runtime Venue B', '2 Test Street', 'Test City', 'NY', '10002', 'America/New_York');

insert into public.events (id, host_organization_id, venue_id, name, starts_at, ends_at, timezone, capacity, registration_deadline, status, created_by_admin_id)
values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Runtime Event A', now() + interval '3 days', now() + interval '3 days 1 hour', 'America/New_York', 2, now() + interval '2 days', 'OPEN', '10000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'Runtime Event B', now() + interval '4 days', now() + interval '4 days 1 hour', 'America/New_York', 2, now() + interval '3 days', 'OPEN', '10000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Runtime RPC Event', now() + interval '5 days', now() + interval '5 days 1 hour', 'America/New_York', 2, now() + interval '4 days', 'OPEN', '10000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Runtime Full Event', now() + interval '6 days', now() + interval '6 days 1 hour', 'America/New_York', 1, now() + interval '5 days', 'OPEN', '10000000-0000-0000-0000-000000000001');

update public.events set attendance_processing_state = 'OPEN'
where id = '40000000-0000-0000-0000-000000000001';

insert into public.participants (id, first_name, last_name, normalized_first_name, normalized_last_name, display_phone, normalized_phone, phone_country)
values
  ('50000000-0000-0000-0000-000000000001', 'Host', 'Participant A', 'host', 'participant a', '+15550000001', '+15550000001', 'US'),
  ('50000000-0000-0000-0000-000000000002', 'Host', 'Participant B', 'host', 'participant b', '+15550000002', '+15550000002', 'US');

insert into public.acknowledgment_versions (id, type, version, exact_text, content_hash, effective_at, legal_status, created_by_admin_id)
values
  ('60000000-0000-0000-0000-000000000001', 'PARTICIPATION_RISK', 1, 'Runtime participation text', digest('Runtime participation text', 'sha256'), now(), 'APPROVED', '10000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000002', 'DATA_USE', 1, 'Runtime data use text', digest('Runtime data use text', 'sha256'), now(), 'APPROVED', '10000000-0000-0000-0000-000000000001');

insert into public.registration_groups (id, participant_id, submission_source, participation_acknowledgment_version_id, participation_acknowledged_at, data_use_acknowledgment_version_id, data_use_acknowledged_at)
values
  ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'SYSTEM_ADMIN', '60000000-0000-0000-0000-000000000001', now(), '60000000-0000-0000-0000-000000000002', now()),
  ('70000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'SYSTEM_ADMIN', '60000000-0000-0000-0000-000000000001', now(), '60000000-0000-0000-0000-000000000002', now());

insert into public.registrations (id, registration_group_id, participant_id, event_id)
values
  ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001'),
  ('80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002'),
  ('80000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004');

insert into public.attendance (id, registration_id, status, updated_by_admin_id)
values ('90000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'ATTENDED', '10000000-0000-0000-0000-000000000001');
insert into public.follow_up_tasks (participant_id, event_id, reason, trigger_key, due_at)
values ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'FIRST_ATTENDANCE', 'runtime-first-attendance', now());
insert into public.participant_notes (participant_id, note, created_by_admin_id)
values ('50000000-0000-0000-0000-000000000001', 'Runtime private note', '10000000-0000-0000-0000-000000000001');
insert into public.audit_events (id, action, entity_type, entity_id)
values ('a0000000-0000-0000-0000-000000000001', 'RUNTIME_TEST', 'Participant', '50000000-0000-0000-0000-000000000001');

-- Anonymous privilege and public-surface checks.
set role anon;
do $$
begin
  if has_table_privilege('anon', 'public.participants', 'SELECT') then raise exception 'anon participant privilege leaked'; end if;
  if has_table_privilege('anon', 'public.registrations', 'INSERT') then raise exception 'anon registration insert privilege leaked'; end if;
  if not has_table_privilege('anon', 'public.public_event_schedule', 'SELECT') then raise exception 'anon public schedule privilege missing'; end if;
  if not has_function_privilege('anon', 'public.register_selected_events_with_legal(text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[])', 'EXECUTE') then raise exception 'anon legal RPC privilege missing'; end if;
  if has_function_privilege('anon', 'public.has_event_access(uuid)', 'EXECUTE') then raise exception 'anon helper privilege leaked'; end if;
end;
$$;

-- Cancellation and immutable evidence protections.
set role postgres;
do $$
declare
  cancelled_registration_id uuid := '80000000-0000-0000-0000-000000000010';
begin
  insert into public.registrations (id, registration_group_id, participant_id, event_id, registration_status, registration_outcome, cancellation_reason)
  values (cancelled_registration_id, '70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'CANCELLED', 'PARTICIPANT_CANCELLED', 'runtime cancellation');
  begin
    insert into public.attendance (registration_id, status, updated_by_admin_id)
    values (cancelled_registration_id, 'NO_SHOW', '10000000-0000-0000-0000-000000000001');
    raise exception 'cancelled registration became no-show';
  exception when check_violation then null;
  end;
end;
$$;

-- Anonymous registration: valid call, replay, duplicate, partial success, and invalid evidence.
set role postgres;
insert into public.participants (
  id, first_name, last_name, normalized_first_name, normalized_last_name,
  display_phone, normalized_phone, phone_country, primary_affiliation_organization_id,
  affiliation_other_text
)
values (
  '50000000-0000-0000-0000-000000000006', 'Existing', 'Affiliated', 'existing', 'affiliated',
  '+15550000006', '+15550000006', 'US', '20000000-0000-0000-0000-000000000001', 'Existing CRM affiliation'
);
set role anon;
do $$
declare
  response jsonb;
begin
  response := public.register_selected_events_with_legal(
    'Existing', 'Affiliated', '+15550000006', '+15550000006', 'US', null, null, null,
    array['40000000-0000-0000-0000-000000000002'::uuid],
    '60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002',
    now(), now(), '127.0.0.1', 'phase-1-referral-runtime', 'runtime-referral',
    'OTHER', 'Partner recommendation',
    array['03500000-0000-0000-0000-000000000001'::uuid,'03500000-0000-0000-0000-000000000002'::uuid,'03500000-0000-0000-0000-000000000003'::uuid,'03500000-0000-0000-0000-000000000004'::uuid,'03500000-0000-0000-0000-000000000005'::uuid]
  );
  perform set_config('app.referral_group_id', response->>'registration_group_id', true);
end;
$$;

set role postgres;
do $$
declare
  referral_group_id uuid := current_setting('app.referral_group_id')::uuid;
begin
  if (select primary_affiliation_organization_id from public.participants where id = '50000000-0000-0000-0000-000000000006')
      <> '20000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'existing participant primary affiliation changed';
  end if;
  if (select referral_source from public.registrations where registration_group_id = referral_group_id)
      <> 'OTHER'::public.registration_referral_source then
    raise exception 'referral source was not stored';
  end if;
  if (select referral_source_other_text from public.registrations where registration_group_id = referral_group_id)
      <> 'Partner recommendation' then
    raise exception 'referral detail was not stored';
  end if;
  if (select host_organization_id from public.events where id = '40000000-0000-0000-0000-000000000002')
      <> '20000000-0000-0000-0000-000000000002'::uuid then
    raise exception 'event host organization changed';
  end if;
end;
$$;

set role anon;
do $$
declare
  response jsonb;
begin
  response := public.register_selected_events_with_legal('RPC', 'Participant', '+15550000003', '+15550000003', 'US', null, null, null, array['40000000-0000-0000-0000-000000000003'::uuid], '60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', now(), now(), '127.0.0.1', 'phase-1-runtime', 'runtime-replay', null, null, array['03500000-0000-0000-0000-000000000001'::uuid,'03500000-0000-0000-0000-000000000002'::uuid,'03500000-0000-0000-0000-000000000003'::uuid,'03500000-0000-0000-0000-000000000004'::uuid,'03500000-0000-0000-0000-000000000005'::uuid]);
  if coalesce((response->'results'->0->>'success')::boolean, false) is distinct from true then raise exception 'valid RPC registration failed: %', response; end if;
  if response->>'confirmation_token' is null then raise exception 'valid RPC did not return confirmation token'; end if;
  response := public.register_selected_events_with_legal('RPC', 'Participant', '+15550000003', '+15550000003', 'US', null, null, null, array['40000000-0000-0000-0000-000000000003'::uuid], '60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', now(), now(), '127.0.0.1', 'phase-1-runtime', 'runtime-replay', null, null, array['03500000-0000-0000-0000-000000000001'::uuid,'03500000-0000-0000-0000-000000000002'::uuid,'03500000-0000-0000-0000-000000000003'::uuid,'03500000-0000-0000-0000-000000000004'::uuid,'03500000-0000-0000-0000-000000000005'::uuid]);
  if response->>'confirmation_token' is not null then raise exception 'RPC replay issued a new token'; end if;
  if (response->'results'->0->>'success')::boolean is distinct from true then raise exception 'RPC replay did not return the original result'; end if;
  response := public.register_selected_events_with_legal('RPC', 'Participant', '+15550000003', '+15550000003', 'US', null, null, null, array['40000000-0000-0000-0000-000000000003'::uuid], '60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', now(), now(), '127.0.0.1', 'phase-1-runtime', 'runtime-duplicate', null, null, array['03500000-0000-0000-0000-000000000001'::uuid,'03500000-0000-0000-0000-000000000002'::uuid,'03500000-0000-0000-0000-000000000003'::uuid,'03500000-0000-0000-0000-000000000004'::uuid,'03500000-0000-0000-0000-000000000005'::uuid]);
  if response->'results'->0->>'reason' <> 'ALREADY_REGISTERED' then raise exception 'duplicate RPC was not rejected: %', response; end if;
  response := public.register_selected_events_with_legal('Partial', 'Participant', '+15550000004', '+15550000004', 'US', null, null, null, array['40000000-0000-0000-0000-000000000003'::uuid, '40000000-0000-0000-0000-000000000004'::uuid], '60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', now(), now(), '127.0.0.1', 'phase-1-runtime', 'runtime-partial', null, null, array['03500000-0000-0000-0000-000000000001'::uuid,'03500000-0000-0000-0000-000000000002'::uuid,'03500000-0000-0000-0000-000000000003'::uuid,'03500000-0000-0000-0000-000000000004'::uuid,'03500000-0000-0000-0000-000000000005'::uuid]);
  if (response->'results'->0->>'success')::boolean is distinct from true or response->'results'->1->>'reason' <> 'FULL' then raise exception 'partial RPC result incorrect: %', response; end if;
exception when others then
  if sqlerrm like 'invalid Participation%' then return; end if;
  raise;
end;
$$;

do $$
begin
  begin
    perform public.register_selected_events_with_legal('Bad', 'Acknowledgment', '+15550000005', '+15550000005', 'US', null, null, null, array['40000000-0000-0000-0000-000000000003'::uuid], gen_random_uuid(), '60000000-0000-0000-0000-000000000002', now(), now(), '127.0.0.1', 'phase-1-runtime', 'runtime-invalid-ack', null, null, array['03500000-0000-0000-0000-000000000001'::uuid,'03500000-0000-0000-0000-000000000002'::uuid,'03500000-0000-0000-0000-000000000003'::uuid,'03500000-0000-0000-0000-000000000004'::uuid,'03500000-0000-0000-0000-000000000005'::uuid]);
    raise exception 'invalid acknowledgment was accepted';
  exception when others then
    if sqlerrm not like 'invalid Participation%' then raise; end if;
  end;
end;
$$;

-- J5-16 Event creation RPC: direct authenticated calls, replay, authorization,
-- relationship, and asset-reference tampering checks.
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
do $$
declare
  response jsonb;
begin
  response := public.phase3_create_event_bundle(
    '41000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000001'::uuid,
    null,
    null,
    jsonb_build_array(jsonb_build_object(
      'id', '41000000-0000-0000-0000-000000000002',
      'series_occurrence_number', null,
      'starts_at', now() + interval '12 days',
      'ends_at', now() + interval '12 days 1 hour',
      'registration_deadline', now() + interval '11 days'
    )),
    jsonb_build_object(
      'host_organization_id', '20000000-0000-0000-0000-000000000001',
      'venue_id', '30000000-0000-0000-0000-000000000001',
      'name', 'Runtime RPC Created Event',
      'timezone', 'America/New_York',
      'capacity', 10,
      'visibility', 'PUBLIC',
      'occurrence_count', 1
    ),
    '[]'::jsonb,
    'EVENT_CREATED',
    jsonb_build_object(
      'name', 'Runtime RPC Created Event',
      'host_organization_id', '20000000-0000-0000-0000-000000000001',
      'venue_id', '30000000-0000-0000-0000-000000000001',
      'timezone', 'America/New_York',
      'occurrence_count', 1
    )
  );
  if coalesce((response->>'idempotent')::boolean, true) then raise exception 'first RPC call was idempotent'; end if;
  if (select count(*) from public.events where id = '41000000-0000-0000-0000-000000000002') <> 1 then raise exception 'direct RPC event was not persisted'; end if;

  response := public.phase3_create_event_bundle(
    '41000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000001'::uuid,
    null, null,
    jsonb_build_array(jsonb_build_object('id', '41000000-0000-0000-0000-000000000003', 'series_occurrence_number', null, 'starts_at', now() + interval '12 days', 'ends_at', now() + interval '12 days 1 hour', 'registration_deadline', now() + interval '11 days')),
    jsonb_build_object('host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'name', 'Runtime RPC Created Event', 'timezone', 'America/New_York', 'capacity', 10, 'visibility', 'PUBLIC', 'occurrence_count', 1),
    '[]'::jsonb, 'EVENT_CREATED',
    jsonb_build_object('name', 'Runtime RPC Created Event', 'host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'timezone', 'America/New_York', 'occurrence_count', 1)
  );
  if not coalesce((response->>'idempotent')::boolean, false) then raise exception 'same-request replay was not idempotent'; end if;
  if (select count(*) from public.events where name = 'Runtime RPC Created Event') <> 1 then raise exception 'same-request replay created a duplicate event'; end if;

  -- Every material logical-input mismatch must reject the same request id.
  create or replace function pg_temp.assert_j5_replay_rejected(
    p_actor uuid, p_defaults jsonb, p_rows jsonb, p_assets jsonb, p_action text, p_audit jsonb
  ) returns void language plpgsql as $fn$
  begin
    perform public.phase3_create_event_bundle(
      '41000000-0000-0000-0000-000000000001'::uuid, p_actor, null, null,
      p_rows, p_defaults, p_assets, p_action, p_audit
    );
    raise exception 'mismatched replay was accepted';
  exception when others then
    if sqlerrm = 'mismatched replay was accepted' then raise; end if;
  end;
  $fn$;

  perform pg_temp.assert_j5_replay_rejected(
    '10000000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object('host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'name', 'Changed Organization', 'timezone', 'America/New_York', 'capacity', 10, 'visibility', 'PUBLIC'),
    jsonb_build_array(jsonb_build_object('id', '41000000-0000-0000-0000-000000000005', 'series_occurrence_number', null, 'starts_at', now() + interval '12 days', 'ends_at', now() + interval '12 days 1 hour', 'registration_deadline', now() + interval '11 days')),
    '[]'::jsonb, 'EVENT_CREATED', jsonb_build_object('name', 'Changed Organization', 'host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'timezone', 'America/New_York', 'occurrence_count', 1)
  );
  perform pg_temp.assert_j5_replay_rejected(
    '10000000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object('host_organization_id', '20000000-0000-0000-0000-000000000002', 'venue_id', '30000000-0000-0000-0000-000000000002', 'name', 'Runtime RPC Created Event', 'timezone', 'America/New_York', 'capacity', 10, 'visibility', 'PUBLIC'),
    jsonb_build_array(jsonb_build_object('id', '41000000-0000-0000-0000-000000000006', 'series_occurrence_number', null, 'starts_at', now() + interval '12 days', 'ends_at', now() + interval '12 days 1 hour', 'registration_deadline', now() + interval '11 days')),
    '[]'::jsonb, 'EVENT_CREATED', jsonb_build_object('name', 'Runtime RPC Created Event', 'host_organization_id', '20000000-0000-0000-0000-000000000002', 'venue_id', '30000000-0000-0000-0000-000000000002', 'timezone', 'America/New_York', 'occurrence_count', 1)
  );
  perform pg_temp.assert_j5_replay_rejected(
    '10000000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object('host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'name', 'Runtime RPC Created Event', 'timezone', 'UTC', 'capacity', 10, 'visibility', 'PUBLIC'),
    jsonb_build_array(jsonb_build_object('id', '41000000-0000-0000-0000-000000000007', 'series_occurrence_number', null, 'starts_at', now() + interval '12 days', 'ends_at', now() + interval '12 days 1 hour', 'registration_deadline', now() + interval '11 days')),
    '[]'::jsonb, 'EVENT_CREATED', jsonb_build_object('name', 'Runtime RPC Created Event', 'host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'timezone', 'UTC', 'occurrence_count', 1)
  );
  perform pg_temp.assert_j5_replay_rejected(
    '10000000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object('host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'name', 'Runtime RPC Created Event', 'timezone', 'America/New_York', 'capacity', 10, 'visibility', 'PUBLIC'),
    jsonb_build_array(jsonb_build_object('id', '41000000-0000-0000-0000-000000000008', 'series_occurrence_number', null, 'starts_at', now() + interval '13 days', 'ends_at', now() + interval '13 days 1 hour', 'registration_deadline', now() + interval '12 days')),
    '[]'::jsonb, 'EVENT_CREATED', jsonb_build_object('name', 'Runtime RPC Created Event', 'host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'timezone', 'America/New_York', 'occurrence_count', 1)
  );
  perform set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
  perform pg_temp.assert_j5_replay_rejected(
    '10000000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object('host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'name', 'Runtime RPC Created Event', 'timezone', 'America/New_York', 'capacity', 10, 'visibility', 'PUBLIC'),
    jsonb_build_array(jsonb_build_object('id', '41000000-0000-0000-0000-000000000009', 'series_occurrence_number', null, 'starts_at', now() + interval '12 days', 'ends_at', now() + interval '12 days 1 hour', 'registration_deadline', now() + interval '11 days')),
    '[]'::jsonb, 'EVENT_SERIES_CREATED', jsonb_build_object('name', 'Runtime RPC Created Event', 'host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'timezone', 'America/New_York', 'occurrence_count', 1)
  );
  perform set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
  perform pg_temp.assert_j5_replay_rejected(
    '10000000-0000-0000-0000-000000000004'::uuid,
    jsonb_build_object('host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'name', 'Runtime RPC Created Event', 'timezone', 'America/New_York', 'capacity', 10, 'visibility', 'PUBLIC'),
    jsonb_build_array(jsonb_build_object('id', '41000000-0000-0000-0000-000000000010', 'series_occurrence_number', null, 'starts_at', now() + interval '12 days', 'ends_at', now() + interval '12 days 1 hour', 'registration_deadline', now() + interval '11 days')),
    '[]'::jsonb, 'EVENT_CREATED', jsonb_build_object('name', 'Runtime RPC Created Event', 'host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'timezone', 'America/New_York', 'occurrence_count', 1)
  );

  perform set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
  perform pg_temp.assert_j5_replay_rejected(
    '10000000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object('host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'name', 'Runtime RPC Created Event', 'timezone', 'America/New_York', 'capacity', 10, 'visibility', 'PUBLIC'),
    jsonb_build_array(jsonb_build_object('id', '41000000-0000-0000-0000-000000000011', 'series_occurrence_number', null, 'starts_at', now() + interval '12 days', 'ends_at', now() + interval '12 days 1 hour', 'registration_deadline', now() + interval '11 days')),
    jsonb_build_array(jsonb_build_object('event_id', '41000000-0000-0000-0000-000000000011', 'storage_path', 'event_image_staging/41000000-0000-0000-0000-000000000001/replay.jpg', 'original_filename', 'replay.jpg', 'mime_type', 'image/jpeg', 'byte_size', 10, 'alt_text', 'Replay image')),
    'EVENT_CREATED', jsonb_build_object('name', 'Runtime RPC Created Event', 'host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'timezone', 'America/New_York', 'occurrence_count', 1)
  );

  begin
    perform public.phase3_create_event_bundle(
      '41000000-0000-0000-0000-000000000002'::uuid,
      '10000000-0000-0000-0000-000000000001'::uuid,
      null, null,
      jsonb_build_array(jsonb_build_object('id', '41000000-0000-0000-0000-000000000004', 'series_occurrence_number', null, 'starts_at', now() + interval '12 days', 'ends_at', now() + interval '12 days 1 hour', 'registration_deadline', now() + interval '11 days')),
      jsonb_build_object('host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'name', 'Tampered Asset Event', 'timezone', 'America/New_York', 'capacity', 10, 'visibility', 'PUBLIC', 'occurrence_count', 1),
      jsonb_build_array(jsonb_build_object('event_id', '40000000-0000-0000-0000-000000000001', 'storage_path', 'event_image_staging/41000000-0000-0000-0000-000000000002/foreign/file.jpg', 'original_filename', 'file.jpg', 'mime_type', 'image/jpeg', 'byte_size', 10, 'alt_text', 'tampered')),
      'EVENT_CREATED',
      jsonb_build_object('name', 'Tampered Asset Event', 'host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'timezone', 'America/New_York', 'occurrence_count', 1)
    );
    raise exception 'unrelated asset event id was accepted';
  exception when others then
    if sqlerrm not like '%unrelated event%' then raise; end if;
  end;

end;
$$;

-- Image-backed logical replay: regenerated staging paths and Event UUIDs are
-- transport details; the server-computed content digest is the stable identity.
do $$
declare
  first_response jsonb;
  replay_response jsonb;
begin
  first_response := public.phase3_create_event_bundle(
    '42000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000001'::uuid,
    null, null,
    jsonb_build_array(jsonb_build_object('id', '42000000-0000-0000-0000-000000000002', 'series_occurrence_number', null, 'starts_at', now() + interval '15 days', 'ends_at', now() + interval '15 days 1 hour', 'registration_deadline', now() + interval '14 days')),
    jsonb_build_object('host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'name', 'Runtime Image Replay Event', 'timezone', 'America/New_York', 'capacity', 10, 'visibility', 'PUBLIC'),
    jsonb_build_array(jsonb_build_object('event_id', '42000000-0000-0000-0000-000000000002', 'storage_path', 'event_image_staging/42000000-0000-0000-0000-000000000001/attempt-a.jpg', 'original_filename', 'image.jpg', 'mime_type', 'image/jpeg', 'byte_size', 5, 'content_sha256', '6105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3d', 'alt_text', 'Runtime Image Replay Event image')),
    'EVENT_CREATED', jsonb_build_object('name', 'Runtime Image Replay Event', 'host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'timezone', 'America/New_York', 'occurrence_count', 1)
  );
  if coalesce((first_response->>'idempotent')::boolean, true) then raise exception 'first image RPC call was idempotent'; end if;

  replay_response := public.phase3_create_event_bundle(
    '42000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000001'::uuid,
    null, null,
    jsonb_build_array(jsonb_build_object('id', '42000000-0000-0000-0000-000000000003', 'series_occurrence_number', null, 'starts_at', now() + interval '15 days', 'ends_at', now() + interval '15 days 1 hour', 'registration_deadline', now() + interval '14 days')),
    jsonb_build_object('host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'name', 'Runtime Image Replay Event', 'timezone', 'America/New_York', 'capacity', 10, 'visibility', 'PUBLIC'),
    jsonb_build_array(jsonb_build_object('event_id', '42000000-0000-0000-0000-000000000003', 'storage_path', 'event_image_staging/42000000-0000-0000-0000-000000000001/attempt-b.jpg', 'original_filename', 'image.jpg', 'mime_type', 'image/jpeg', 'byte_size', 5, 'content_sha256', '6105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3d', 'alt_text', 'Runtime Image Replay Event image')),
    'EVENT_CREATED', jsonb_build_object('name', 'Runtime Image Replay Event', 'host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'timezone', 'America/New_York', 'occurrence_count', 1)
  );
  if not coalesce((replay_response->>'idempotent')::boolean, false) then raise exception 'image replay was not idempotent'; end if;
  if replay_response->'event_ids'->>0 <> first_response->'event_ids'->>0 then raise exception 'image replay returned a different Event'; end if;
  if (select count(*) from public.events where name = 'Runtime Image Replay Event') <> 1 then raise exception 'image replay created duplicate Events'; end if;
  if (select count(*) from public.design_assets where event_id = (first_response->'event_ids'->>0)::uuid) <> 1 then raise exception 'image replay created duplicate assets'; end if;

  begin
    perform public.phase3_create_event_bundle(
      '42000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, null, null,
      jsonb_build_array(jsonb_build_object('id', '42000000-0000-0000-0000-000000000004', 'series_occurrence_number', null, 'starts_at', now() + interval '15 days', 'ends_at', now() + interval '15 days 1 hour', 'registration_deadline', now() + interval '14 days')),
      jsonb_build_object('host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'name', 'Runtime Image Replay Event', 'timezone', 'America/New_York', 'capacity', 10, 'visibility', 'PUBLIC'),
      jsonb_build_array(jsonb_build_object('event_id', '42000000-0000-0000-0000-000000000004', 'storage_path', 'event_image_staging/42000000-0000-0000-0000-000000000001/attempt-c.jpg', 'original_filename', 'image.jpg', 'mime_type', 'image/jpeg', 'byte_size', 7, 'content_sha256', 'd67e2e944994496c8d8ec76eed0cf9f09679448d584b532bebf941852a37f5ed', 'alt_text', 'Runtime Image Replay Event image')),
      'EVENT_CREATED', jsonb_build_object('name', 'Runtime Image Replay Event', 'host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'timezone', 'America/New_York', 'occurrence_count', 1)
    );
    raise exception 'different image replay was accepted';
  exception when others then
    if sqlerrm = 'different image replay was accepted' then raise; end if;
  end;

  begin
    perform public.phase3_create_event_bundle(
      '42000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, null, null,
      jsonb_build_array(jsonb_build_object('id', '42000000-0000-0000-0000-000000000005', 'series_occurrence_number', null, 'starts_at', now() + interval '15 days', 'ends_at', now() + interval '15 days 1 hour', 'registration_deadline', now() + interval '14 days')),
      jsonb_build_object('host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'name', 'Runtime Image Replay Event', 'timezone', 'America/New_York', 'capacity', 10, 'visibility', 'PUBLIC'),
      '[]'::jsonb, 'EVENT_CREATED', jsonb_build_object('name', 'Runtime Image Replay Event', 'host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'timezone', 'America/New_York', 'occurrence_count', 1)
    );
    raise exception 'image/no-image replay was accepted';
  exception when others then
    if sqlerrm = 'image/no-image replay was accepted' then raise; end if;
  end;
end;
$$;

-- Recurring image replay: occurrence sequence, not generated UUID/path, is the
-- stable asset key. Exercise regenerated IDs/paths and reversed input order.
do $$
declare
  first_response jsonb;
  replay_response jsonb;
  occurrence_one uuid;
  occurrence_two uuid;
  replay_one uuid;
  replay_two uuid;
  attempt integer;
begin
  first_response := public.phase3_create_event_bundle(
    '43000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000001'::uuid,
    '43000000-0000-0000-0000-000000000002'::uuid,
    '2099-08-27'::date,
    jsonb_build_array(
      jsonb_build_object('id', '43000000-0000-0000-0000-000000000003', 'series_occurrence_number', 1, 'starts_at', '2099-08-20 14:00:00+00'::timestamptz, 'ends_at', '2099-08-20 15:00:00+00'::timestamptz, 'registration_deadline', '2099-08-20 13:00:00+00'::timestamptz),
      jsonb_build_object('id', '43000000-0000-0000-0000-000000000004', 'series_occurrence_number', 2, 'starts_at', '2099-08-27 14:00:00+00'::timestamptz, 'ends_at', '2099-08-27 15:00:00+00'::timestamptz, 'registration_deadline', '2099-08-27 13:00:00+00'::timestamptz)
    ),
    jsonb_build_object('host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'name', 'Runtime Recurring Image Replay', 'timezone', 'America/New_York', 'capacity', 10, 'visibility', 'PUBLIC'),
    jsonb_build_array(
      jsonb_build_object('event_id', '43000000-0000-0000-0000-000000000003', 'storage_path', 'event_image_staging/43000000-0000-0000-0000-000000000001/first-a.jpg', 'original_filename', 'a.jpg', 'mime_type', 'image/jpeg', 'byte_size', 7, 'content_sha256', '84127d9feb9345703f2ea1ce0c14f6dfb935b8b04816230d160f03922c94ff31', 'alt_text', 'first image'),
      jsonb_build_object('event_id', '43000000-0000-0000-0000-000000000004', 'storage_path', 'event_image_staging/43000000-0000-0000-0000-000000000001/first-b.jpg', 'original_filename', 'b.jpg', 'mime_type', 'image/jpeg', 'byte_size', 7, 'content_sha256', '657f504b469e7f2a0d8ce3cd481194445f99ee57b40fc9d7fe28d8ecad1fc09b', 'alt_text', 'second image')
    ),
    'EVENT_SERIES_CREATED', jsonb_build_object('name', 'Runtime Recurring Image Replay', 'host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'timezone', 'America/New_York', 'frequency', 'WEEKLY', 'ends_on', '2099-08-27', 'occurrence_count', 2)
  );
  if coalesce((first_response->>'idempotent')::boolean, true) then raise exception 'first recurring image call was idempotent'; end if;

  replay_response := public.phase3_create_event_bundle(
    '43000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000001'::uuid,
    '43000000-0000-0000-0000-000000000005'::uuid,
    '2099-08-27'::date,
    jsonb_build_array(
      jsonb_build_object('id', '43000000-0000-0000-0000-000000000007', 'series_occurrence_number', 2, 'starts_at', '2099-08-27 14:00:00+00'::timestamptz, 'ends_at', '2099-08-27 15:00:00+00'::timestamptz, 'registration_deadline', '2099-08-27 13:00:00+00'::timestamptz),
      jsonb_build_object('id', '43000000-0000-0000-0000-000000000006', 'series_occurrence_number', 1, 'starts_at', '2099-08-20 14:00:00+00'::timestamptz, 'ends_at', '2099-08-20 15:00:00+00'::timestamptz, 'registration_deadline', '2099-08-20 13:00:00+00'::timestamptz)
    ),
    jsonb_build_object('host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'name', 'Runtime Recurring Image Replay', 'timezone', 'America/New_York', 'capacity', 10, 'visibility', 'PUBLIC'),
    jsonb_build_array(
      jsonb_build_object('event_id', '43000000-0000-0000-0000-000000000007', 'storage_path', 'event_image_staging/43000000-0000-0000-0000-000000000001/retry-b.jpg', 'original_filename', 'b.jpg', 'mime_type', 'image/jpeg', 'byte_size', 7, 'content_sha256', '657f504b469e7f2a0d8ce3cd481194445f99ee57b40fc9d7fe28d8ecad1fc09b', 'alt_text', 'second image'),
      jsonb_build_object('event_id', '43000000-0000-0000-0000-000000000006', 'storage_path', 'event_image_staging/43000000-0000-0000-0000-000000000001/retry-a.jpg', 'original_filename', 'a.jpg', 'mime_type', 'image/jpeg', 'byte_size', 7, 'content_sha256', '84127d9feb9345703f2ea1ce0c14f6dfb935b8b04816230d160f03922c94ff31', 'alt_text', 'first image')
    ),
    'EVENT_SERIES_CREATED', jsonb_build_object('name', 'Runtime Recurring Image Replay', 'host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'timezone', 'America/New_York', 'frequency', 'WEEKLY', 'ends_on', '2099-08-27', 'occurrence_count', 2)
  );
  if not coalesce((replay_response->>'idempotent')::boolean, false) then raise exception 'recurring image replay was not idempotent'; end if;
  if replay_response->'event_ids' <> first_response->'event_ids' then raise exception 'recurring image replay returned different Events'; end if;
  if (select count(*) from public.events where name = 'Runtime Recurring Image Replay') <> 2 then raise exception 'recurring image replay created duplicate Events'; end if;
  if (select count(*) from public.design_assets where event_id in (select (value)::uuid from jsonb_array_elements_text(first_response->'event_ids') value)) <> 2 then raise exception 'recurring image replay created duplicate assets'; end if;

  begin
    occurrence_one := gen_random_uuid();
    occurrence_two := gen_random_uuid();
    perform public.phase3_create_event_bundle(
      '43000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, gen_random_uuid(), '2099-08-27'::date,
      jsonb_build_array(jsonb_build_object('id', occurrence_one, 'series_occurrence_number', 1, 'starts_at', '2099-08-20 14:00:00+00'::timestamptz, 'ends_at', '2099-08-20 15:00:00+00'::timestamptz, 'registration_deadline', '2099-08-20 13:00:00+00'::timestamptz), jsonb_build_object('id', occurrence_two, 'series_occurrence_number', 2, 'starts_at', '2099-08-27 14:00:00+00'::timestamptz, 'ends_at', '2099-08-27 15:00:00+00'::timestamptz, 'registration_deadline', '2099-08-27 13:00:00+00'::timestamptz)),
      jsonb_build_object('host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'name', 'Runtime Recurring Image Replay', 'timezone', 'America/New_York', 'capacity', 10, 'visibility', 'PUBLIC'),
      jsonb_build_array(
        jsonb_build_object('event_id', occurrence_one, 'storage_path', 'event_image_staging/43000000-0000-0000-0000-000000000001/swapped-a.jpg', 'original_filename', 'a.jpg', 'mime_type', 'image/jpeg', 'byte_size', 7, 'content_sha256', '657f504b469e7f2a0d8ce3cd481194445f99ee57b40fc9d7fe28d8ecad1fc09b', 'alt_text', 'first image'),
        jsonb_build_object('event_id', occurrence_two, 'storage_path', 'event_image_staging/43000000-0000-0000-0000-000000000001/swapped-b.jpg', 'original_filename', 'b.jpg', 'mime_type', 'image/jpeg', 'byte_size', 7, 'content_sha256', '84127d9feb9345703f2ea1ce0c14f6dfb935b8b04816230d160f03922c94ff31', 'alt_text', 'second image')
      ),
      'EVENT_SERIES_CREATED', jsonb_build_object('name', 'Runtime Recurring Image Replay', 'host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'timezone', 'America/New_York', 'frequency', 'WEEKLY', 'ends_on', '2099-08-27', 'occurrence_count', 2)
    );
    raise exception 'wrong occurrence image linkage was accepted';
  exception when others then
    if sqlerrm = 'wrong occurrence image linkage was accepted' then raise; end if;
  end;

  for attempt in 1..30 loop
    occurrence_one := gen_random_uuid(); occurrence_two := gen_random_uuid();
    replay_one := gen_random_uuid(); replay_two := gen_random_uuid();
    replay_response := public.phase3_create_event_bundle(
      '43000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid,
      gen_random_uuid(), '2099-08-27'::date,
      jsonb_build_array(
        jsonb_build_object('id', replay_two, 'series_occurrence_number', 2, 'starts_at', '2099-08-27 14:00:00+00'::timestamptz, 'ends_at', '2099-08-27 15:00:00+00'::timestamptz, 'registration_deadline', '2099-08-27 13:00:00+00'::timestamptz),
        jsonb_build_object('id', replay_one, 'series_occurrence_number', 1, 'starts_at', '2099-08-20 14:00:00+00'::timestamptz, 'ends_at', '2099-08-20 15:00:00+00'::timestamptz, 'registration_deadline', '2099-08-20 13:00:00+00'::timestamptz)
      ),
      jsonb_build_object('host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'name', 'Runtime Recurring Image Replay', 'timezone', 'America/New_York', 'capacity', 10, 'visibility', 'PUBLIC'),
      jsonb_build_array(
        jsonb_build_object('event_id', replay_two, 'storage_path', format('event_image_staging/43000000-0000-0000-0000-000000000001/loop-%s-b.jpg', attempt), 'original_filename', 'b.jpg', 'mime_type', 'image/jpeg', 'byte_size', 7, 'content_sha256', '657f504b469e7f2a0d8ce3cd481194445f99ee57b40fc9d7fe28d8ecad1fc09b', 'alt_text', 'second image'),
        jsonb_build_object('event_id', replay_one, 'storage_path', format('event_image_staging/43000000-0000-0000-0000-000000000001/loop-%s-a.jpg', attempt), 'original_filename', 'a.jpg', 'mime_type', 'image/jpeg', 'byte_size', 7, 'content_sha256', '84127d9feb9345703f2ea1ce0c14f6dfb935b8b04816230d160f03922c94ff31', 'alt_text', 'first image')
      ),
      'EVENT_SERIES_CREATED', jsonb_build_object('name', 'Runtime Recurring Image Replay', 'host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'timezone', 'America/New_York', 'frequency', 'WEEKLY', 'ends_on', '2099-08-27', 'occurrence_count', 2)
    );
    if not coalesce((replay_response->>'idempotent')::boolean, false) then raise exception 'recurring stability replay % was not idempotent', attempt; end if;
  end loop;

  begin
    perform public.phase3_create_event_bundle(
      '43000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, gen_random_uuid(), '2099-08-27'::date,
      jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'series_occurrence_number', 1, 'starts_at', '2099-08-20 14:00:00+00'::timestamptz, 'ends_at', '2099-08-20 15:00:00+00'::timestamptz, 'registration_deadline', '2099-08-20 13:00:00+00'::timestamptz), jsonb_build_object('id', gen_random_uuid(), 'series_occurrence_number', 2, 'starts_at', '2099-08-27 14:00:00+00'::timestamptz, 'ends_at', '2099-08-27 15:00:00+00'::timestamptz, 'registration_deadline', '2099-08-27 13:00:00+00'::timestamptz)),
      jsonb_build_object('host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'name', 'Runtime Recurring Image Replay', 'timezone', 'America/New_York', 'capacity', 10, 'visibility', 'PUBLIC'),
      '[]'::jsonb, 'EVENT_SERIES_CREATED', jsonb_build_object('name', 'Runtime Recurring Image Replay', 'host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'timezone', 'America/New_York', 'frequency', 'WEEKLY', 'ends_on', '2099-08-27', 'occurrence_count', 2)
    );
    raise exception 'recurring image/no-image replay was accepted';
  exception when others then
    if sqlerrm = 'recurring image/no-image replay was accepted' then raise; end if;
  end;
end;
$$;

-- Inactive venues are rejected independently of UI filtering.
do $$
begin
  update public.venues set active_status = 'INACTIVE'
  where id = '30000000-0000-0000-0000-000000000001';
  begin
    perform public.phase3_create_event_bundle(
      '44000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, null, null,
      jsonb_build_array(jsonb_build_object('id', '44000000-0000-0000-0000-000000000002', 'series_occurrence_number', null, 'starts_at', now() + interval '20 days', 'ends_at', now() + interval '20 days 1 hour', 'registration_deadline', now() + interval '19 days')),
      jsonb_build_object('host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'name', 'Runtime Inactive Venue Event', 'timezone', 'America/New_York', 'capacity', 10, 'visibility', 'PUBLIC'),
      '[]'::jsonb, 'EVENT_CREATED', jsonb_build_object('name', 'Runtime Inactive Venue Event', 'host_organization_id', '20000000-0000-0000-0000-000000000001', 'venue_id', '30000000-0000-0000-0000-000000000001', 'timezone', 'America/New_York', 'occurrence_count', 1)
    );
    raise exception 'inactive venue was accepted';
  exception when others then
    if sqlerrm = 'inactive venue was accepted' then raise; end if;
  end;
  update public.venues set active_status = 'ACTIVE'
  where id = '30000000-0000-0000-0000-000000000001';
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
do $$
begin
  begin
    perform public.phase3_create_event_bundle(
      '41000000-0000-0000-0000-000000000003'::uuid,
      '10000000-0000-0000-0000-000000000002'::uuid,
      null, null, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, 'EVENT_CREATED', '{}'::jsonb
    );
    raise exception 'Host Admin was allowed to create an event through RPC';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

-- Host Admin A is isolated to Organization A; Host Admin B receives the inverse view.
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
do $$
begin
  if not public.has_event_access('40000000-0000-0000-0000-000000000001') then raise exception 'Host A lost own event access'; end if;
  if public.has_event_access('40000000-0000-0000-0000-000000000002') then raise exception 'Host A gained Organization B event access'; end if;
  if (select count(*) from public.events where id = '40000000-0000-0000-0000-000000000001') <> 1 then raise exception 'Host A cannot read own event'; end if;
  if (select count(*) from public.events where id = '40000000-0000-0000-0000-000000000002') <> 0 then raise exception 'Host A can read Organization B event'; end if;
  if (select count(distinct p.id) from public.participants p join public.registrations r on r.participant_id = p.id where r.event_id = '40000000-0000-0000-0000-000000000001') <> 1 then raise exception 'Host A cannot read own roster participant'; end if;
  if (select count(distinct p.id) from public.participants p join public.registrations r on r.participant_id = p.id where r.event_id = '40000000-0000-0000-0000-000000000002') <> 0 then raise exception 'Host A can read Organization B participant'; end if;
  if (select count(*) from public.follow_up_tasks) <> 0 then raise exception 'Host A can read global follow-up tasks'; end if;
  if (select count(*) from public.participant_notes) <> 0 then raise exception 'Host A can read private notes'; end if;
  if (select count(*) from public.audit_events) <> 0 then raise exception 'Host A can read audit events'; end if;
  if (select count(*) from public.over_capacity_overrides) <> 0 then raise exception 'Host A can read/create overrides'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
do $$
begin
  if not public.has_event_access('40000000-0000-0000-0000-000000000002') then raise exception 'Host B lost own event access'; end if;
  if public.has_event_access('40000000-0000-0000-0000-000000000001') then raise exception 'Host B gained Organization A event access'; end if;
end;
$$;

-- System Admin has global read access but immutable evidence remains protected.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
do $$
begin
  if (select count(*) from public.events where id in ('40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002')) <> 2 then raise exception 'System Admin lacks global event access'; end if;
  if (select count(*) from public.participants) < 2 then raise exception 'System Admin lacks global participant access'; end if;
  begin
    update public.audit_events set action = 'MUTATED' where id = 'a0000000-0000-0000-0000-000000000001';
    raise exception 'immutable audit event was updated';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.audit_events where id = 'a0000000-0000-0000-0000-000000000001';
    raise exception 'immutable audit event was deleted';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Critical relational protections.
do $$
begin
  begin
    insert into public.registrations (registration_group_id, participant_id, event_id)
    values ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001');
    raise exception 'duplicate active registration was accepted';
  exception when unique_violation then null;
  end;
  begin
    update public.events set capacity = 1 where id = '40000000-0000-0000-0000-000000000004';
    raise exception 'capacity reduction below active registrations was accepted';
  exception when others then
    if sqlerrm not like '%capacity%' then raise; end if;
  end;
  if (select count(*) from public.attendance_transitions where attendance_id = '90000000-0000-0000-0000-000000000001') <> 1 then raise exception 'attendance transition was not recorded'; end if;
end;
$$;

rollback;
reset role;
reset all;
