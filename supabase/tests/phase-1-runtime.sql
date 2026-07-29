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
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'host-b@example.test', now(), now(), now());

insert into public.admin_profiles (id, display_name, email, role, status)
values
  ('10000000-0000-0000-0000-000000000001', 'Runtime System Admin', 'system@example.test', 'SYSTEM_ADMIN', 'ACTIVE'),
  ('10000000-0000-0000-0000-000000000002', 'Runtime Host Admin A', 'host-a@example.test', 'HOST_ADMIN', 'PENDING'),
  ('10000000-0000-0000-0000-000000000003', 'Runtime Host Admin B', 'host-b@example.test', 'HOST_ADMIN', 'PENDING');

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
  if not has_function_privilege('anon', 'public.register_selected_events(text,text,text,text,text,text,text,uuid,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text)', 'EXECUTE') then raise exception 'anon RPC privilege missing'; end if;
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
set role anon;
do $$
declare
  response jsonb;
begin
  response := public.register_selected_events('RPC', 'Participant', '+15550000003', '+15550000003', 'US', null, null, '20000000-0000-0000-0000-000000000001', null, null, array['40000000-0000-0000-0000-000000000003'::uuid], '60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', now(), now(), '127.0.0.1', 'phase-1-runtime', 'runtime-replay');
  if coalesce((response->'results'->0->>'success')::boolean, false) is distinct from true then raise exception 'valid RPC registration failed: %', response; end if;
  if response->>'confirmation_token' is null then raise exception 'valid RPC did not return confirmation token'; end if;
  response := public.register_selected_events('RPC', 'Participant', '+15550000003', '+15550000003', 'US', null, null, '20000000-0000-0000-0000-000000000001', null, null, array['40000000-0000-0000-0000-000000000003'::uuid], '60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', now(), now(), '127.0.0.1', 'phase-1-runtime', 'runtime-replay');
  if response->>'confirmation_token' is not null then raise exception 'RPC replay issued a new token'; end if;
  if (response->'results'->0->>'success')::boolean is distinct from true then raise exception 'RPC replay did not return the original result'; end if;
  response := public.register_selected_events('RPC', 'Participant', '+15550000003', '+15550000003', 'US', null, null, '20000000-0000-0000-0000-000000000001', null, null, array['40000000-0000-0000-0000-000000000003'::uuid], '60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', now(), now(), '127.0.0.1', 'phase-1-runtime', 'runtime-duplicate');
  if response->'results'->0->>'reason' <> 'ALREADY_REGISTERED' then raise exception 'duplicate RPC was not rejected: %', response; end if;
  response := public.register_selected_events('Partial', 'Participant', '+15550000004', '+15550000004', 'US', null, null, '20000000-0000-0000-0000-000000000001', null, null, array['40000000-0000-0000-0000-000000000003'::uuid, '40000000-0000-0000-0000-000000000004'::uuid], '60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', now(), now(), '127.0.0.1', 'phase-1-runtime', 'runtime-partial');
  if (response->'results'->0->>'success')::boolean is distinct from true or response->'results'->1->>'reason' <> 'FULL' then raise exception 'partial RPC result incorrect: %', response; end if;
exception when others then
  if sqlerrm like 'invalid Participation%' then return; end if;
  raise;
end;
$$;

do $$
begin
  begin
    perform public.register_selected_events('Bad', 'Acknowledgment', '+15550000005', '+15550000005', 'US', null, null, null, null, null, array['40000000-0000-0000-0000-000000000003'::uuid], gen_random_uuid(), '60000000-0000-0000-0000-000000000002', now(), now(), '127.0.0.1', 'phase-1-runtime', 'runtime-invalid-ack');
    raise exception 'invalid acknowledgment was accepted';
  exception when others then
    if sqlerrm not like 'invalid Participation%' then raise; end if;
  end;
end;
$$;

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
