-- RC2 participant contact correction boundary assertions.
-- Run against a disposable database after applying all migrations.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
values
  ('15000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'contact-system@example.test', now(), now(), now()),
  ('15000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'contact-host@example.test', now(), now(), now());
insert into public.admin_profiles (id, display_name, email, role, status)
values
  ('15000000-0000-0000-0000-000000000001', 'Contact System', 'contact-system@example.test', 'SYSTEM_ADMIN', 'ACTIVE'),
  ('15000000-0000-0000-0000-000000000002', 'Contact Host', 'contact-host@example.test', 'HOST_ADMIN', 'ACTIVE');
insert into public.organizations (id, name)
values ('15000000-0000-0000-0000-000000000010', 'Contact Organization');
insert into public.admin_organization_assignments (admin_profile_id, organization_id, created_by_admin_id)
values ('15000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000010', '15000000-0000-0000-0000-000000000001');
insert into public.venues (id, organization_id, name, street, city, state, postal_code)
values ('15000000-0000-0000-0000-000000000011', '15000000-0000-0000-0000-000000000010', 'Contact Venue', '1 Test Street', 'Test', 'NY', '10001');
insert into public.events (id, host_organization_id, venue_id, name, starts_at, ends_at, timezone, capacity, registration_deadline, status, created_by_admin_id)
values ('15000000-0000-0000-0000-000000000012', '15000000-0000-0000-0000-000000000010', '15000000-0000-0000-0000-000000000011', 'Contact Event', now() - interval '2 days', now() - interval '2 days' + interval '1 hour', 'America/New_York', 10, now(), 'COMPLETED', '15000000-0000-0000-0000-000000000001');
insert into public.acknowledgment_versions (id, type, version, exact_text, content_hash, effective_at, legal_status, created_by_admin_id)
values ('15000000-0000-0000-0000-000000000013', 'PARTICIPATION_RISK', 1, 'Contact test acknowledgment', digest('Contact test acknowledgment', 'sha256'), now(), 'PROVISIONAL', '15000000-0000-0000-0000-000000000001');
insert into public.cancellation_template_versions (id, template_type, version, exact_text, status, created_by_admin_id)
values ('15000000-0000-0000-0000-000000000014', 'PERMANENT_CANCELLATION', 1, 'Contact test cancellation', 'PUBLISHED', '15000000-0000-0000-0000-000000000001');
insert into public.participants (id, first_name, last_name, normalized_first_name, normalized_last_name, display_phone, normalized_phone, phone_country, email, normalized_email)
values
  ('15000000-0000-0000-0000-000000000020', 'Original', 'Person', 'original', 'person', '(518) 555-0101', '+15185550101', 'US', 'ORIGINAL@EXAMPLE.TEST', 'original@example.test'),
  ('15000000-0000-0000-0000-000000000021', 'Collision', 'Person', 'collision', 'person', '+1 518 555 0102', '+15185550102', 'US', 'collision@example.test', 'collision@example.test');
insert into public.registration_groups (id, participant_id, submission_source, participation_acknowledgment_version_id, participation_acknowledged_at, data_use_acknowledgment_version_id, data_use_acknowledged_at)
values ('15000000-0000-0000-0000-000000000022', '15000000-0000-0000-0000-000000000020', 'SYSTEM_ADMIN', '15000000-0000-0000-0000-000000000013', now(), '15000000-0000-0000-0000-000000000013', now());
insert into public.registrations (id, registration_group_id, participant_id, event_id)
values ('15000000-0000-0000-0000-000000000023', '15000000-0000-0000-0000-000000000022', '15000000-0000-0000-0000-000000000020', '15000000-0000-0000-0000-000000000012');
update public.events set attendance_processing_state = 'FINALIZED' where id = '15000000-0000-0000-0000-000000000012';
insert into public.acknowledgment_acceptances (id, participant_id, registration_group_id, acknowledgment_version_id, acceptance_method, ip_address, user_agent)
values ('15000000-0000-0000-0000-000000000024', '15000000-0000-0000-0000-000000000020', '15000000-0000-0000-0000-000000000022', '15000000-0000-0000-0000-000000000013', 'CONTACT_TEST', '127.0.0.1', 'contact-test');
insert into public.attendance (id, registration_id, status, finalized_at, updated_by_admin_id)
values ('15000000-0000-0000-0000-000000000025', '15000000-0000-0000-0000-000000000023', 'ATTENDED', now(), '15000000-0000-0000-0000-000000000001');
insert into public.follow_up_tasks (id, participant_id, event_id, reason, trigger_key, due_at, status, task_title, task_description, template_key, suggested_message)
values ('15000000-0000-0000-0000-000000000026', '15000000-0000-0000-0000-000000000020', '15000000-0000-0000-0000-000000000012', 'FIRST_ATTENDANCE', 'contact-test-follow-up', now(), 'PENDING', 'Contact test follow-up', 'Contact test', 'contact-test-v1', 'Contact test');
insert into public.event_cancellations (id, event_id, cancelled_by_admin_id, cancellation_type, reason, active_registrations_affected, confirmed_at, template_version_id, rendered_message_snapshot)
values ('15000000-0000-0000-0000-000000000027', '15000000-0000-0000-0000-000000000012', '15000000-0000-0000-0000-000000000001', 'PERMANENT', 'Contact test cancellation', 1, now(), '15000000-0000-0000-0000-000000000014', 'Contact test cancellation');
insert into public.participant_notification_tasks (id, participant_id, event_id, event_cancellation_id, template_version_id, template_type, suggested_message, event_starts_at_snapshot, created_at, due_at)
values ('15000000-0000-0000-0000-000000000028', '15000000-0000-0000-0000-000000000020', '15000000-0000-0000-0000-000000000012', '15000000-0000-0000-0000-000000000027', '15000000-0000-0000-0000-000000000014', 'PERMANENT_CANCELLATION', 'Contact test cancellation', now(), now(), now());
set role authenticated;
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000001', true);
insert into public.participant_notification_deliveries (id, participant_notification_task_id, registration_id, channel)
values ('15000000-0000-0000-0000-000000000029', '15000000-0000-0000-0000-000000000028', '15000000-0000-0000-0000-000000000023', 'EMAIL');

select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000001', true);

do $$
declare
  result jsonb;
  updated_participant public.participants%rowtype;
  correction_audit public.audit_events%rowtype;
  original_case_count integer;
  repeated_case_count integer;
begin
  result := public.phase6_correct_participant_contact(
    '15000000-0000-0000-0000-000000000020',
    '  Zoë   de  Person ', '  New' || chr(9) || 'Name ', '  (703) 555-1212  ', '+17035551212', 'us',
    '  NEW@EXAMPLE.TEST ', 'new@example.test', '  Corrected' || chr(9) || 'from source  '
  );
  if result->>'status' <> 'UPDATED' then raise exception 'System Admin correction did not update'; end if;
  select * into updated_participant from public.participants where id = '15000000-0000-0000-0000-000000000020';
  if updated_participant.id <> '15000000-0000-0000-0000-000000000020'
     or updated_participant.first_name <> 'Zoë de Person'
     or updated_participant.last_name <> 'New Name'
     or updated_participant.normalized_first_name <> 'zoë de person'
     or updated_participant.normalized_last_name <> 'new name'
     or updated_participant.normalized_phone <> '+17035551212'
     or updated_participant.email <> 'new@example.test'
     or updated_participant.normalized_email <> 'new@example.test' then
    raise exception 'canonical contact correction values are wrong';
  end if;
  select * into correction_audit from public.audit_events where action = 'PARTICIPANT_CONTACT_CORRECTED' and entity_id = updated_participant.id order by created_at desc limit 1;
  if correction_audit.id is null
     or correction_audit.reason <> 'Corrected from source'
     or correction_audit.old_values->>'first_name' <> 'Original'
     or correction_audit.new_values->>'first_name' <> 'Zoë de Person' then
    raise exception 'contact correction before/after audit is missing';
  end if;
  if (select count(*) from public.registrations where participant_id = updated_participant.id) <> 1
     or (select count(*) from public.acknowledgment_acceptances where participant_id = updated_participant.id) <> 1
     or (select count(*) from public.attendance a join public.registrations r on r.id = a.registration_id where r.participant_id = updated_participant.id) <> 1
     or not exists (select 1 from public.follow_up_tasks where id = '15000000-0000-0000-0000-000000000026' and participant_id = updated_participant.id)
     or (select count(*) from public.participant_notification_tasks where participant_id = updated_participant.id) <> 1
     or (select count(*) from public.participant_notification_deliveries d join public.participant_notification_tasks t on t.id = d.participant_notification_task_id where t.participant_id = updated_participant.id) <> 1 then
    raise exception 'participant history was changed or lost';
  end if;

  result := public.phase6_correct_participant_contact(
    updated_participant.id, 'Collision', 'Person', '+1 518 555 0102', '+15185550102', 'US',
    'collision@example.test', 'collision@example.test', 'Review possible duplicate'
  );
  if result->>'status' <> 'REVIEW_REQUIRED' or (result->>'possible_duplicate_case_id') is null then
    raise exception 'collision did not create a review case';
  end if;
  original_case_count := (select count(*) from public.possible_duplicate_cases where candidate_participant_id = updated_participant.id and possible_match_participant_id = '15000000-0000-0000-0000-000000000021');
  result := public.phase6_correct_participant_contact(
    updated_participant.id, 'Collision', 'Person', '+1 518 555 0102', '+15185550102', 'US',
    'collision@example.test', 'collision@example.test', 'Review possible duplicate'
  );
  repeated_case_count := (select count(*) from public.possible_duplicate_cases where candidate_participant_id = updated_participant.id and possible_match_participant_id = '15000000-0000-0000-0000-000000000021');
  if original_case_count <> 1 or repeated_case_count <> 1 or result->>'status' <> 'REVIEW_REQUIRED' then
    raise exception 'collision review case was duplicated';
  end if;
  if (select normalized_phone from public.participants where id = updated_participant.id) <> '+17035551212' then
    raise exception 'collision changed participant contact details';
  end if;
end;
$$;

-- The Host Admin cannot use the correction RPC or direct table writes.
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000002', true);
do $$
begin
  begin
    perform public.phase6_correct_participant_contact(
      '15000000-0000-0000-0000-000000000020', 'No', 'Access', '+17035551212', '+17035551212', 'US', null, null, 'Denied'
    );
    raise exception 'Host Admin was allowed to correct participant contact';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.participants set first_name = 'No Access' where id = '15000000-0000-0000-0000-000000000020';
    raise exception 'Host Admin was allowed to update participant directly';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
reset all;
rollback;
