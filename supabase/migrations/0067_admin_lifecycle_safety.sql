-- RC2: System Admin-controlled Host Admin lifecycle and assignment safety.
-- All status/assignment mutations in this migration are transactional, audited,
-- and immediately visible to the existing request-time authorization helpers.

create or replace function public.enforce_admin_lifecycle_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  active_system_admin_count integer;
begin
  if tg_table_name = 'admin_profiles' then
    if new.role is distinct from old.role then
      raise exception 'administrator role is immutable' using errcode = '42501';
    end if;
    if new.status is distinct from old.status then
      if current_setting('app.admin_lifecycle_mutation', true) is distinct from '1' then
        raise exception 'administrator status must be changed through the lifecycle RPC' using errcode = '42501';
      end if;
      if old.role = 'SYSTEM_ADMIN' and old.status = 'ACTIVE' and new.status <> 'ACTIVE' then
        perform pg_advisory_xact_lock(hashtextextended('arakkis.admin.lifecycle.system-admins', 0));
        select count(*) into active_system_admin_count
        from public.admin_profiles
        where role = 'SYSTEM_ADMIN' and status = 'ACTIVE';
        if active_system_admin_count <= 1 then
          raise exception 'the last active System Admin cannot be deactivated' using errcode = '23514';
        end if;
      end if;
    end if;
  elsif tg_table_name = 'admin_organization_assignments' then
    if new.admin_profile_id is distinct from old.admin_profile_id
       or new.organization_id is distinct from old.organization_id
       or new.created_by_admin_id is distinct from old.created_by_admin_id
       or new.created_at is distinct from old.created_at then
      raise exception 'administrator assignments are immutable except for lifecycle revocation' using errcode = '42501';
    end if;
    if new.revoked_at is distinct from old.revoked_at
       and current_setting('app.admin_lifecycle_mutation', true) is distinct from '1' then
      raise exception 'administrator assignments must be changed through the lifecycle RPC' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists admin_profiles_lifecycle_guard on public.admin_profiles;
create trigger admin_profiles_lifecycle_guard
before update on public.admin_profiles
for each row execute function public.enforce_admin_lifecycle_mutation();

drop trigger if exists admin_assignments_lifecycle_guard on public.admin_organization_assignments;
create trigger admin_assignments_lifecycle_guard
before update on public.admin_organization_assignments
for each row execute function public.enforce_admin_lifecycle_mutation();

create or replace function public.has_active_host_access(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_active_system_admin()
    or exists (
      select 1
      from public.admin_profiles p
      join public.admin_organization_assignments a on a.admin_profile_id = p.id
      join public.organizations o on o.id = a.organization_id
      where p.id = auth.uid()
        and p.role = 'HOST_ADMIN'
        and p.status = 'ACTIVE'
        and a.organization_id = target_organization_id
        and a.revoked_at is null
        and o.active_status = 'ACTIVE'
    );
$$;

create or replace function public.deactivate_admin_profile(
  p_admin_profile_id uuid,
  p_actor_admin_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target public.admin_profiles%rowtype;
begin
  if p_admin_profile_id is null or p_actor_admin_id is null
     or char_length(btrim(coalesce(p_reason, ''))) < 1 then
    raise exception 'a target and reason are required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('arakkis.admin.lifecycle.system-admins', 0));
  if not exists (
    select 1 from public.admin_profiles
    where id = p_actor_admin_id and role = 'SYSTEM_ADMIN' and status = 'ACTIVE'
  ) then
    raise exception 'administrator is not authorized' using errcode = '42501';
  end if;
  select * into target from public.admin_profiles where id = p_admin_profile_id for update;
  if not found or target.role <> 'HOST_ADMIN' then
    raise exception 'only a Host Admin can be deactivated' using errcode = '42501';
  end if;
  if target.status = 'DEACTIVATED' then return false; end if;
  if target.status not in ('ACTIVE', 'SUSPENDED') then
    raise exception 'administrator is not in a deactivatable state' using errcode = '22023';
  end if;

  perform set_config('app.admin_lifecycle_mutation', '1', true);
  perform set_config('app.admin_lifecycle_actor', p_actor_admin_id::text, true);
  update public.admin_profiles set status = 'DEACTIVATED' where id = p_admin_profile_id;
  insert into public.audit_events (actor_admin_id, action, entity_type, entity_id, old_values, new_values, reason)
  values (
    p_actor_admin_id, 'HOST_ADMIN_DEACTIVATED', 'ADMIN_PROFILE', p_admin_profile_id,
    jsonb_build_object('status', target.status), jsonb_build_object('status', 'DEACTIVATED'), btrim(p_reason)
  );
  return true;
end;
$$;

create or replace function public.reactivate_admin_profile(
  p_admin_profile_id uuid,
  p_actor_admin_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target public.admin_profiles%rowtype;
begin
  if p_admin_profile_id is null or p_actor_admin_id is null
     or char_length(btrim(coalesce(p_reason, ''))) < 1 then
    raise exception 'a target and reason are required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('arakkis.admin.lifecycle.system-admins', 0));
  if not exists (
    select 1 from public.admin_profiles
    where id = p_actor_admin_id and role = 'SYSTEM_ADMIN' and status = 'ACTIVE'
  ) then
    raise exception 'administrator is not authorized' using errcode = '42501';
  end if;
  select * into target from public.admin_profiles where id = p_admin_profile_id for update;
  if not found or target.role <> 'HOST_ADMIN' then
    raise exception 'only a Host Admin can be reactivated' using errcode = '42501';
  end if;
  if target.status = 'ACTIVE' then return false; end if;
  if target.status not in ('SUSPENDED', 'DEACTIVATED') then
    raise exception 'administrator is not in a reactivatable state' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.admin_organization_assignments a
    join public.organizations o on o.id = a.organization_id
    where a.admin_profile_id = p_admin_profile_id
      and a.revoked_at is null
      and o.active_status = 'ACTIVE'
  ) then
    raise exception 'an active Host Admin requires an active organization assignment' using errcode = '23514';
  end if;

  perform set_config('app.admin_lifecycle_mutation', '1', true);
  perform set_config('app.admin_lifecycle_actor', p_actor_admin_id::text, true);
  update public.admin_profiles set status = 'ACTIVE' where id = p_admin_profile_id;
  insert into public.audit_events (actor_admin_id, action, entity_type, entity_id, old_values, new_values, reason)
  values (
    p_actor_admin_id, 'HOST_ADMIN_REACTIVATED', 'ADMIN_PROFILE', p_admin_profile_id,
    jsonb_build_object('status', target.status), jsonb_build_object('status', 'ACTIVE'), btrim(p_reason)
  );
  return true;
end;
$$;

create or replace function public.add_admin_organization_assignment(
  p_admin_profile_id uuid,
  p_organization_id uuid,
  p_actor_admin_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target public.admin_profiles%rowtype;
  existing public.admin_organization_assignments%rowtype;
  assignment_found boolean;
  inserted boolean := false;
begin
  if p_admin_profile_id is null or p_organization_id is null or p_actor_admin_id is null
     or char_length(btrim(coalesce(p_reason, ''))) < 1 then
    raise exception 'a target, organization, and reason are required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('arakkis.admin.lifecycle.system-admins', 0));
  if not exists (
    select 1 from public.admin_profiles
    where id = p_actor_admin_id and role = 'SYSTEM_ADMIN' and status = 'ACTIVE'
  ) then
    raise exception 'administrator is not authorized' using errcode = '42501';
  end if;
  select * into target from public.admin_profiles where id = p_admin_profile_id for update;
  if not found or target.role <> 'HOST_ADMIN' or target.status = 'PENDING' then
    raise exception 'only an established Host Admin can receive an assignment' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations where id = p_organization_id and active_status = 'ACTIVE') then
    raise exception 'organization is not active' using errcode = '22023';
  end if;
  select * into existing
  from public.admin_organization_assignments
  where admin_profile_id = p_admin_profile_id and organization_id = p_organization_id
  for update;
  assignment_found := found;
  if assignment_found and existing.revoked_at is null then return false; end if;

  perform set_config('app.admin_lifecycle_mutation', '1', true);
  perform set_config('app.admin_lifecycle_actor', p_actor_admin_id::text, true);
  if assignment_found then
    update public.admin_organization_assignments
    set revoked_at = null
    where admin_profile_id = p_admin_profile_id and organization_id = p_organization_id;
  else
    insert into public.admin_organization_assignments (admin_profile_id, organization_id, created_by_admin_id)
    values (p_admin_profile_id, p_organization_id, p_actor_admin_id);
    inserted := true;
  end if;
  insert into public.audit_events (actor_admin_id, action, entity_type, entity_id, old_values, new_values, reason)
  values (
    p_actor_admin_id, 'HOST_ADMIN_ORGANIZATION_ASSIGNED', 'ADMIN_ORGANIZATION_ASSIGNMENT', p_admin_profile_id,
    case when inserted then null else jsonb_build_object('organization_id', p_organization_id, 'revoked_at', existing.revoked_at) end,
    jsonb_build_object('admin_profile_id', p_admin_profile_id, 'organization_id', p_organization_id, 'revoked_at', null), btrim(p_reason)
  );
  return true;
end;
$$;

create or replace function public.revoke_admin_organization_assignment(
  p_admin_profile_id uuid,
  p_organization_id uuid,
  p_actor_admin_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target public.admin_profiles%rowtype;
  assignment public.admin_organization_assignments%rowtype;
begin
  if p_admin_profile_id is null or p_organization_id is null or p_actor_admin_id is null
     or char_length(btrim(coalesce(p_reason, ''))) < 1 then
    raise exception 'a target, organization, and reason are required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('arakkis.admin.lifecycle.system-admins', 0));
  if not exists (
    select 1 from public.admin_profiles
    where id = p_actor_admin_id and role = 'SYSTEM_ADMIN' and status = 'ACTIVE'
  ) then
    raise exception 'administrator is not authorized' using errcode = '42501';
  end if;
  select * into target from public.admin_profiles where id = p_admin_profile_id for update;
  if not found or target.role <> 'HOST_ADMIN' then
    raise exception 'only a Host Admin assignment can be revoked' using errcode = '42501';
  end if;
  select * into assignment
  from public.admin_organization_assignments
  where admin_profile_id = p_admin_profile_id and organization_id = p_organization_id
  for update;
  if not found or assignment.revoked_at is not null then return false; end if;

  perform set_config('app.admin_lifecycle_mutation', '1', true);
  perform set_config('app.admin_lifecycle_actor', p_actor_admin_id::text, true);
  update public.admin_organization_assignments
  set revoked_at = now()
  where admin_profile_id = p_admin_profile_id and organization_id = p_organization_id;
  insert into public.audit_events (actor_admin_id, action, entity_type, entity_id, old_values, new_values, reason)
  values (
    p_actor_admin_id, 'HOST_ADMIN_ORGANIZATION_REVOKED', 'ADMIN_ORGANIZATION_ASSIGNMENT', p_admin_profile_id,
    jsonb_build_object('organization_id', p_organization_id, 'revoked_at', null),
    jsonb_build_object('organization_id', p_organization_id, 'revoked_at', now()), btrim(p_reason)
  );

  if target.status = 'ACTIVE' and not exists (
    select 1 from public.admin_organization_assignments
    where admin_profile_id = p_admin_profile_id and revoked_at is null
  ) then
    update public.admin_profiles set status = 'SUSPENDED' where id = p_admin_profile_id;
    insert into public.audit_events (actor_admin_id, action, entity_type, entity_id, old_values, new_values, reason)
    values (
      p_actor_admin_id, 'HOST_ADMIN_SUSPENDED_NO_ACTIVE_ASSIGNMENTS', 'ADMIN_PROFILE', p_admin_profile_id,
      jsonb_build_object('status', 'ACTIVE'), jsonb_build_object('status', 'SUSPENDED'), btrim(p_reason)
    );
  end if;
  return true;
end;
$$;

drop policy if exists system_admin_all_admin_profiles on public.admin_profiles;
drop policy if exists system_admin_all_admin_organization_assignments on public.admin_organization_assignments;
create policy system_admin_read_admin_profiles on public.admin_profiles
for select to authenticated using (public.is_active_system_admin());
create policy system_admin_read_admin_assignments on public.admin_organization_assignments
for select to authenticated using (public.is_active_system_admin());

revoke insert, update, delete on public.admin_profiles from authenticated;
revoke insert, update, delete on public.admin_organization_assignments from authenticated;

revoke all on function public.enforce_admin_lifecycle_mutation() from public;
revoke all on function public.deactivate_admin_profile(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.reactivate_admin_profile(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.add_admin_organization_assignment(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.revoke_admin_organization_assignment(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.deactivate_admin_profile(uuid, uuid, text) to service_role;
grant execute on function public.reactivate_admin_profile(uuid, uuid, text) to service_role;
grant execute on function public.add_admin_organization_assignment(uuid, uuid, uuid, text) to service_role;
grant execute on function public.revoke_admin_organization_assignment(uuid, uuid, uuid, text) to service_role;
