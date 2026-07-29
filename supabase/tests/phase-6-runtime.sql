-- Phase 6 trigger and lifecycle runtime assertions on synthetic local data.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
values ('11000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'phase6@example.test', now(), now(), now());
insert into public.admin_profiles (id, display_name, email, role, status)
values ('11000000-0000-0000-0000-000000000001', 'Phase 6 System', 'phase6@example.test', 'SYSTEM_ADMIN', 'ACTIVE');
insert into public.organizations (id, name) values ('21000000-0000-0000-0000-000000000001', 'Phase 6 Organization');
insert into public.venues (id, organization_id, name, street, city, state, postal_code, timezone)
values ('31000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'Phase 6 Venue', '1 Test', 'Test', 'NY', '10001', 'America/New_York');
insert into public.events (id, host_organization_id, venue_id, name, starts_at, ends_at, timezone, capacity, registration_deadline, status, created_by_admin_id)
values ('41000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'First Event', now() - interval '2 days', now() - interval '2 days' + interval '1 hour', 'America/New_York', 5, now(), 'COMPLETED', '11000000-0000-0000-0000-000000000001');
insert into public.acknowledgment_versions (id, type, version, exact_text, content_hash, effective_at, legal_status, created_by_admin_id)
values ('61000000-0000-0000-0000-000000000001', 'PARTICIPATION_RISK', 1, 'Synthetic participation', digest('Synthetic participation', 'sha256'), now(), 'PROVISIONAL', '11000000-0000-0000-0000-000000000001'),
       ('61000000-0000-0000-0000-000000000002', 'DATA_USE', 1, 'Synthetic data use', digest('Synthetic data use', 'sha256'), now(), 'PROVISIONAL', '11000000-0000-0000-0000-000000000001');
insert into public.participants (id, first_name, last_name, normalized_first_name, normalized_last_name, display_phone, normalized_phone, phone_country)
values ('51000000-0000-0000-0000-000000000001', 'Synthetic', 'Attendee', 'synthetic', 'attendee', '+15550000001', '+15550000001', 'US');
insert into public.registration_groups (id, participant_id, submission_source, participation_acknowledgment_version_id, participation_acknowledged_at, data_use_acknowledgment_version_id, data_use_acknowledged_at)
values ('71000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'SYSTEM_ADMIN', '61000000-0000-0000-0000-000000000001', now(), '61000000-0000-0000-0000-000000000002', now());
insert into public.registrations (id, registration_group_id, participant_id, event_id)
values ('81000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001');
update public.events set attendance_processing_state = 'FINALIZED' where id = '41000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
insert into public.attendance (registration_id, status, finalized_at, updated_by_admin_id)
values ('81000000-0000-0000-0000-000000000001', 'ATTENDED', now(), '11000000-0000-0000-0000-000000000001');
do $$
begin
  if (select count(*) from public.follow_up_tasks where trigger_key = 'first-attendance:51000000-0000-0000-0000-000000000001') <> 1 then raise exception 'first attendance task was not created'; end if;
  if (select due_at from public.follow_up_tasks where trigger_key = 'first-attendance:51000000-0000-0000-0000-000000000001') <> (select ends_at + interval '24 hours' from public.events where id = '41000000-0000-0000-0000-000000000001') then raise exception 'first attendance due time is wrong'; end if;
  update public.attendance set finalized_at = finalized_at where registration_id = '81000000-0000-0000-0000-000000000001';
  if (select count(*) from public.follow_up_tasks where trigger_key = 'first-attendance:51000000-0000-0000-0000-000000000001') <> 1 then raise exception 'reconciliation duplicated first task'; end if;
  perform public.phase6_complete_follow_up_task((select id from public.follow_up_tasks where trigger_key = 'first-attendance:51000000-0000-0000-0000-000000000001'), 'CONTACTED', 'Synthetic completion');
  if (select status from public.follow_up_tasks where trigger_key = 'first-attendance:51000000-0000-0000-0000-000000000001') <> 'COMPLETED' then raise exception 'completion did not persist'; end if;
end $$;
rollback;
reset role;
reset all;
