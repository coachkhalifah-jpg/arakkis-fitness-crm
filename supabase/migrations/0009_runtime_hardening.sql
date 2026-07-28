-- Phase 1B / 0009: runtime hardening for trigger writes and scoped mutations.
-- Forward-only correction: 0001-0008 are already part of the Phase 1 baseline.

-- Audit rows written by an application trigger must not be blocked by the
-- caller's RLS policy.  SECURITY DEFINER does not change auth.uid(), so the
-- recorded actor remains the authenticated administrator.
create or replace function public.record_attendance_transition()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor uuid;
begin
  if auth.uid() is not null and new.updated_by_admin_id is distinct from auth.uid() then
    raise exception 'attendance actor must be the authenticated administrator' using errcode = '42501';
  end if;
  actor := coalesce(new.updated_by_admin_id, auth.uid());
  if actor is null then
    raise exception 'attendance transition requires an administrator' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    insert into public.attendance_transitions
      (attendance_id, from_status, to_status, changed_by_admin_id, source)
    values (new.id, null, new.status, actor, 'CHECK_IN');
  elsif old.status is distinct from new.status
     or old.checked_in_at is distinct from new.checked_in_at
     or old.finalized_at is distinct from new.finalized_at then
    insert into public.attendance_transitions
      (attendance_id, from_status, to_status, changed_by_admin_id, source, reason)
    values (new.id, old.status, new.status, actor, 'CORRECTION', 'Database-recorded attendance change');
  end if;
  return new;
end;
$$;

create or replace function public.record_notification_transition()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'notification transition requires an administrator' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    insert into public.notification_delivery_transitions
      (delivery_id, previous_status, new_status, actor_admin_id, channel)
    values (new.id, null, new.status, actor, new.channel);
  elsif old.status is distinct from new.status then
    insert into public.notification_delivery_transitions
      (delivery_id, previous_status, new_status, actor_admin_id, channel, note)
    values (new.id, old.status, new.status, actor, new.channel, new.delivery_note);
  end if;
  return new;
end;
$$;

-- Relationship and actor fields are not Host Admin editing surfaces.  The
-- RLS predicates protect which Event is visible, while these guards protect
-- the identity and historical relationships inside an authorized Event.
create or replace function public.enforce_scoped_mutation_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if tg_table_name = 'registrations' and tg_op = 'UPDATE'
     and not public.is_active_system_admin() then
    if new.registration_group_id is distinct from old.registration_group_id
       or new.participant_id is distinct from old.participant_id
       or new.event_id is distinct from old.event_id
       or new.affiliation_organization_id_at_registration is distinct from old.affiliation_organization_id_at_registration
       or new.affiliation_other_text_at_registration is distinct from old.affiliation_other_text_at_registration
       or new.registered_at is distinct from old.registered_at
       or new.created_by_admin_id is distinct from old.created_by_admin_id
       or new.over_capacity_override_id is distinct from old.over_capacity_override_id then
      raise exception 'Host Admin cannot change registration identity or historical relationships' using errcode = '42501';
    end if;
  elsif tg_table_name = 'attendance' and tg_op = 'UPDATE' then
    if new.registration_id is distinct from old.registration_id then
      raise exception 'attendance registration is immutable' using errcode = '42501';
    end if;
    if auth.uid() is not null and new.updated_by_admin_id is distinct from auth.uid() then
      raise exception 'attendance actor must be the authenticated administrator' using errcode = '42501';
    end if;
  elsif tg_table_name = 'participant_notification_deliveries' and tg_op = 'UPDATE' then
    if new.participant_notification_task_id is distinct from old.participant_notification_task_id
       or new.registration_id is distinct from old.registration_id then
      raise exception 'notification delivery relationships are immutable' using errcode = '42501';
    end if;
    if not exists (
      select 1
      from public.participant_notification_tasks t
      join public.registrations r on r.id = new.registration_id
      where t.id = new.participant_notification_task_id
        and t.event_id = r.event_id
    ) then
      raise exception 'notification delivery must belong to the task Event' using errcode = '23514';
    end if;
    if not public.is_active_system_admin()
       and new.sent_by_admin_id is not null
       and new.sent_by_admin_id is distinct from auth.uid() then
      raise exception 'notification sender must be the authenticated administrator' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger registrations_scoped_mutation_guard
before update on public.registrations
for each row execute function public.enforce_scoped_mutation_integrity();

create trigger attendance_scoped_mutation_guard
before update on public.attendance
for each row execute function public.enforce_scoped_mutation_integrity();

create trigger notification_delivery_scoped_mutation_guard
before update on public.participant_notification_deliveries
for each row execute function public.enforce_scoped_mutation_integrity();

-- A Host Admin must always have at least one active organization assignment.
-- Deferred checking permits the invitation-acceptance transaction to create the
-- profile and assignment atomically in either order.
create or replace function public.enforce_active_host_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.admin_profiles p
    where p.role = 'HOST_ADMIN'
      and p.status = 'ACTIVE'
      and not exists (
        select 1
        from public.admin_organization_assignments a
        where a.admin_profile_id = p.id
          and a.revoked_at is null
      )
  ) then
    raise exception 'active Host Admin requires an active organization assignment' using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger admin_profiles_active_host_assignment_guard
after insert or update on public.admin_profiles
deferrable initially deferred
for each row execute function public.enforce_active_host_assignment();

create constraint trigger admin_assignments_active_host_assignment_guard
after insert or update on public.admin_organization_assignments
deferrable initially deferred
for each row execute function public.enforce_active_host_assignment();

revoke all on function public.record_attendance_transition() from public;
revoke all on function public.record_notification_transition() from public;
revoke all on function public.enforce_scoped_mutation_integrity() from public;
revoke all on function public.enforce_active_host_assignment() from public;
