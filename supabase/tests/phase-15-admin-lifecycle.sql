-- RC2 admin lifecycle safety assertions.
-- Run as local Postgres superuser against a disposable local database.

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
values
  ('15000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'lifecycle-owner@example.test', now(), now(), now()),
  ('15000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'lifecycle-host@example.test', now(), now(), now());

insert into public.admin_profiles (id, display_name, email, role, status)
values
  ('15000000-0000-0000-0000-000000000001', 'Lifecycle System Admin', 'lifecycle-owner@example.test', 'SYSTEM_ADMIN', 'ACTIVE'),
  ('15000000-0000-0000-0000-000000000002', 'Lifecycle Host Admin', 'lifecycle-host@example.test', 'HOST_ADMIN', 'ACTIVE');

insert into public.organizations (id, name)
values
  ('16000000-0000-0000-0000-000000000001', 'Lifecycle Organization A'),
  ('16000000-0000-0000-0000-000000000002', 'Lifecycle Organization B');
insert into public.admin_organization_assignments (admin_profile_id, organization_id, created_by_admin_id)
values ('15000000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001');

do $$
begin
  if not public.deactivate_admin_profile(
    '15000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001', 'offboarding test'
  ) then raise exception 'Host Admin was not deactivated'; end if;
  if (select status from public.admin_profiles where id = '15000000-0000-0000-0000-000000000002') <> 'DEACTIVATED' then
    raise exception 'Host Admin deactivation did not persist';
  end if;
  if not exists (
    select 1 from public.audit_events
    where action = 'HOST_ADMIN_DEACTIVATED' and entity_id = '15000000-0000-0000-0000-000000000002'
      and old_values->>'status' = 'ACTIVE' and new_values->>'status' = 'DEACTIVATED'
      and reason = 'offboarding test'
  ) then raise exception 'deactivation audit evidence missing'; end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"15000000-0000-0000-0000-000000000002"}', true);
do $$
begin
  if public.has_active_host_access('16000000-0000-0000-0000-000000000001') then
    raise exception 'deactivated Host Admin retained request-time access';
  end if;
end $$;

select set_config('request.jwt.claims', '{}', true);
select public.reactivate_admin_profile(
  '15000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001', 'return from leave'
);
select public.add_admin_organization_assignment(
  '15000000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001', 'second organization scope'
);

do $$
begin
  if (select status from public.admin_profiles where id = '15000000-0000-0000-0000-000000000002') <> 'ACTIVE' then
    raise exception 'Host Admin was not reactivated';
  end if;
  if not exists (
    select 1 from public.admin_organization_assignments
    where admin_profile_id = '15000000-0000-0000-0000-000000000002'
      and organization_id = '16000000-0000-0000-0000-000000000002' and revoked_at is null
  ) then raise exception 'organization assignment was not added'; end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"15000000-0000-0000-0000-000000000002"}', true);
do $$
begin
  if not public.has_active_host_access('16000000-0000-0000-0000-000000000002') then
    raise exception 'active Host Admin did not receive request-time assignment access';
  end if;
end $$;
select set_config('request.jwt.claims', '{}', true);

select public.revoke_admin_organization_assignment(
  '15000000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', 'remove old organization'
);
select public.revoke_admin_organization_assignment(
  '15000000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001', 'remove final organization'
);
do $$
begin
  if (select status from public.admin_profiles where id = '15000000-0000-0000-0000-000000000002') <> 'SUSPENDED' then
    raise exception 'revoking the final assignment did not suspend the Host Admin';
  end if;
  if (select count(*) from public.audit_events where action = 'HOST_ADMIN_SUSPENDED_NO_ACTIVE_ASSIGNMENTS' and entity_id = '15000000-0000-0000-0000-000000000002') <> 1 then
    raise exception 'automatic suspension audit evidence missing';
  end if;
  begin
    perform public.reactivate_admin_profile(
      '15000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001', 'missing assignment test'
    );
    raise exception 'Host Admin without an assignment was reactivated';
  exception when others then
    if sqlstate <> '23514' then raise; end if;
  end;
end $$;

do $$
begin
  perform set_config('app.admin_lifecycle_mutation', '1', true);
  perform set_config('app.admin_lifecycle_actor', '15000000-0000-0000-0000-000000000001', true);
  update public.admin_profiles set status = 'DEACTIVATED'
  where id = '15000000-0000-0000-0000-000000000001';
  raise exception 'the last active System Admin was deactivated';
exception when others then
  if sqlstate <> '23514' or sqlerrm <> 'the last active System Admin cannot be deactivated' then raise; end if;
end $$;

do $$
begin
  if has_table_privilege('authenticated', 'public.admin_profiles', 'UPDATE') then
    raise exception 'authenticated status update privilege was not removed';
  end if;
  if has_table_privilege('authenticated', 'public.admin_organization_assignments', 'UPDATE') then
    raise exception 'authenticated assignment update privilege was not removed';
  end if;
  if has_function_privilege('authenticated', 'public.deactivate_admin_profile(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'authenticated lifecycle RPC privilege leaked';
  end if;
end $$;

rollback;
reset all;
