-- DEC-059 participant manage/recovery link boundary assertions.
-- Run against a disposable database after applying all migrations.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
values
  ('15900000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'recovery-system@example.test', now(), now(), now()),
  ('15900000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'recovery-host@example.test', now(), now(), now());
insert into public.admin_profiles (id, display_name, email, role, status)
values
  ('15900000-0000-0000-0000-000000000001', 'Recovery System', 'recovery-system@example.test', 'SYSTEM_ADMIN', 'ACTIVE'),
  ('15900000-0000-0000-0000-000000000002', 'Recovery Host', 'recovery-host@example.test', 'HOST_ADMIN', 'ACTIVE');
insert into public.organizations (id, name)
values ('15900000-0000-0000-0000-000000000010', 'Recovery Organization');
insert into public.admin_organization_assignments (admin_profile_id, organization_id, created_by_admin_id)
values ('15900000-0000-0000-0000-000000000002', '15900000-0000-0000-0000-000000000010', '15900000-0000-0000-0000-000000000001');
insert into public.participants (id, first_name, last_name, normalized_first_name, normalized_last_name, display_phone, normalized_phone, phone_country, email, normalized_email)
values
  ('15900000-0000-0000-0000-000000000020', 'Recovery', 'Person', 'recovery', 'person', '(518) 555-0199', '+15185550199', 'US', 'recovery@example.test', 'recovery@example.test');

do $$
declare
  first_hash bytea := digest('recovery-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'sha256');
  second_hash bytea := digest('recovery-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'sha256');
  first_id uuid;
  second_id uuid;
  consume jsonb;
  device_count integer;
  audit_payload jsonb;
  revoked boolean;
begin
  -- Host Admin cannot issue
  begin
    perform public.issue_participant_manage_recovery_link(
      '15900000-0000-0000-0000-000000000020',
      first_hash,
      now() + interval '72 hours',
      '15900000-0000-0000-0000-000000000002'
    );
    raise exception 'Host Admin was allowed to issue a recovery link';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm not ilike '%not authorized%' then
        raise;
      end if;
  end;

  first_id := public.issue_participant_manage_recovery_link(
    '15900000-0000-0000-0000-000000000020',
    first_hash,
    now() + interval '72 hours',
    '15900000-0000-0000-0000-000000000001'
  );
  if first_id is null then raise exception 'issue did not return link id'; end if;
  if not exists (
    select 1 from public.audit_events
    where action = 'PARTICIPANT_MANAGE_RECOVERY_ISSUED'
      and entity_id = first_id
      and actor_admin_id = '15900000-0000-0000-0000-000000000001'
      and new_values ? 'participant_id'
      and not (new_values::text ilike '%recovery-token%')
  ) then
    raise exception 'issued audit missing or leaked token';
  end if;

  second_id := public.issue_participant_manage_recovery_link(
    '15900000-0000-0000-0000-000000000020',
    second_hash,
    now() + interval '72 hours',
    '15900000-0000-0000-0000-000000000001'
  );
  if (select status from public.participant_manage_recovery_links where id = first_id) <> 'REPLACED' then
    raise exception 'prior pending link was not replaced on regenerate';
  end if;
  if (select status from public.participant_manage_recovery_links where id = second_id) <> 'PENDING' then
    raise exception 'regenerated link is not pending';
  end if;
  if (select count(*) from public.participant_manage_recovery_links
      where participant_id = '15900000-0000-0000-0000-000000000020' and status = 'PENDING') <> 1 then
    raise exception 'more than one pending recovery link';
  end if;

  -- Old token no longer consumes
  if public.consume_participant_manage_recovery_link('recovery-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa') is not null then
    raise exception 'replaced recovery token remained consumable';
  end if;

  consume := public.consume_participant_manage_recovery_link('recovery-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  if consume is null or consume->>'token' is null or consume->>'participant_id' <> '15900000-0000-0000-0000-000000000020' then
    raise exception 'valid recovery token did not consume';
  end if;
  if (select status from public.participant_manage_recovery_links where id = second_id) <> 'CONSUMED' then
    raise exception 'consumed status not persisted';
  end if;
  select count(*) into device_count
  from public.participant_remembered_devices
  where participant_id = '15900000-0000-0000-0000-000000000020' and revoked_at is null;
  if device_count < 1 then raise exception 'remember-device row was not created on consume'; end if;

  select new_values into audit_payload
  from public.audit_events
  where action = 'PARTICIPANT_MANAGE_RECOVERY_CONSUMED' and entity_id = second_id
  order by created_at desc limit 1;
  if audit_payload is null
     or audit_payload::text ilike '%recovery-token%'
     or audit_payload ? 'token' then
    raise exception 'consume audit missing or leaked raw token';
  end if;

  -- Single-use
  if public.consume_participant_manage_recovery_link('recovery-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbb') is not null then
    raise exception 'consumed recovery token remained reusable';
  end if;

  -- Issue again then revoke
  first_id := public.issue_participant_manage_recovery_link(
    '15900000-0000-0000-0000-000000000020',
    digest('recovery-token-cccccccccccccccccccccccccccccccc', 'sha256'),
    now() + interval '72 hours',
    '15900000-0000-0000-0000-000000000001'
  );
  revoked := public.revoke_participant_manage_recovery_link(
    '15900000-0000-0000-0000-000000000020',
    '15900000-0000-0000-0000-000000000001'
  );
  if not revoked then raise exception 'revoke did not succeed'; end if;
  if public.consume_participant_manage_recovery_link('recovery-token-cccccccccccccccccccccccccccccccc') is not null then
    raise exception 'revoked recovery token remained consumable';
  end if;

  -- Expired
  first_id := public.issue_participant_manage_recovery_link(
    '15900000-0000-0000-0000-000000000020',
    digest('recovery-token-dddddddddddddddddddddddddddddddd', 'sha256'),
    now() + interval '1 hour',
    '15900000-0000-0000-0000-000000000001'
  );
  update public.participant_manage_recovery_links
  set issued_at = now() - interval '2 hours',
      expires_at = now() - interval '1 minute'
  where id = first_id;
  if public.consume_participant_manage_recovery_link('recovery-token-dddddddddddddddddddddddddddddddd') is not null then
    raise exception 'expired recovery token remained consumable';
  end if;

  -- Malformed / short token
  if public.consume_participant_manage_recovery_link('short') is not null then
    raise exception 'malformed token returned data';
  end if;
end;
$$;

rollback;
