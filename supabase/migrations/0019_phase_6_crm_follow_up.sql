-- Phase 6: participant CRM and accountable, manual follow-up workflows.
-- Attendance remains the source of truth; task reconciliation is idempotent.

alter table public.follow_up_tasks
  add column organization_id uuid references public.organizations(id) on delete restrict,
  add column assigned_admin_id uuid references public.admin_profiles(id) on delete restrict,
  add column task_title text not null default 'Follow-up',
  add column task_description text,
  add column template_key text not null default 'legacy-v1',
  add column completion_outcome text,
  add column copied_at timestamptz,
  add column copied_by_admin_id uuid references public.admin_profiles(id) on delete restrict,
  add column updated_at timestamptz not null default now();

update public.follow_up_tasks t
set organization_id = e.host_organization_id,
    task_title = case when t.reason = 'FIRST_ATTENDANCE' then 'First attendance follow-up' else 'No-show follow-up' end,
    template_key = case when t.reason = 'FIRST_ATTENDANCE' then 'first-attendance-v1' else 'no-show-v1' end
from public.events e
where e.id = t.event_id;

alter table public.follow_up_tasks
  add constraint follow_up_completion_outcome_allowed check (
    completion_outcome is null or completion_outcome in ('CONTACTED', 'NO_RESPONSE', 'FOLLOW_UP_NOT_NEEDED', 'WRONG_CONTACT_INFORMATION')
  ),
  add constraint follow_up_completion_consistency check (
    (status = 'PENDING' and completed_at is null and completed_by_admin_id is null and completion_outcome is null)
    or (status in ('COMPLETED', 'DISMISSED') and completed_at is not null and completed_by_admin_id is not null)
  );

create index follow_up_scope_queue_idx on public.follow_up_tasks (organization_id, status, due_at);
create index follow_up_assignee_queue_idx on public.follow_up_tasks (assigned_admin_id, status, due_at);

-- Keep authenticated reads available for the System Admin queue, but prevent
-- direct writes from bypassing the RPC lifecycle and reconciliation trigger.
revoke insert, update, delete on public.follow_up_tasks from authenticated;
grant select on public.follow_up_tasks to authenticated;

create or replace function public.phase6_now()
returns timestamptz language sql stable set search_path = public as $$ select now(); $$;
revoke all on function public.phase6_now() from public;
grant execute on function public.phase6_now() to authenticated;

create trigger follow_up_tasks_updated_at
before update on public.follow_up_tasks
for each row execute function public.set_updated_at();

create or replace function public.phase6_default_follow_up_message(
  p_reason public.follow_up_reason,
  p_first_name text,
  p_event_name text,
  p_organization_name text
)
returns text language sql immutable set search_path = public as $$
  select case p_reason
    when 'FIRST_ATTENDANCE' then format(
      'Hi %s, it was great having you at %s with %s. How are you feeling after the event? We would love to see you again.',
      p_first_name, p_event_name, p_organization_name
    )
    else format(
      'Hi %s, we missed you at %s with %s. Let us know if you would like help finding another event.',
      p_first_name, p_event_name, p_organization_name
    )
  end;
$$;

create or replace function public.phase6_reconcile_follow_up_tasks(p_participant_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  first_attendance record;
  task public.follow_up_tasks%rowtype;
  r record;
  actor uuid := auth.uid();
begin
  perform pg_advisory_xact_lock(hashtextextended('phase6-follow-up:' || p_participant_id::text, 0));

  select e.id, e.name, e.ends_at, e.host_organization_id, p.first_name, o.name as organization_name
  into first_attendance
  from public.attendance a
  join public.registrations r0 on r0.id = a.registration_id
  join public.events e on e.id = r0.event_id
  join public.participants p on p.id = r0.participant_id
  join public.organizations o on o.id = e.host_organization_id
  where r0.participant_id = p_participant_id
    and r0.registration_status = 'REGISTERED'
    and r0.registration_outcome = 'ACTIVE'
    and e.status <> 'CANCELLED'
    and a.status = 'ATTENDED'
    and a.finalized_at is not null
  order by e.starts_at, e.id
  limit 1;

  select * into task from public.follow_up_tasks where trigger_key = 'first-attendance:' || p_participant_id for update;
  if first_attendance.id is null then
    if task.id is not null and task.status = 'PENDING' then
      update public.follow_up_tasks
      set status = 'DISMISSED', completed_at = now(), completed_by_admin_id = coalesce(actor, completed_by_admin_id),
          completion_notes = 'Attendance was corrected and no qualifying first attendance remains.'
      where id = task.id;
    end if;
  elsif task.id is null then
    insert into public.follow_up_tasks (
      participant_id, organization_id, event_id, reason, trigger_key, due_at, status,
      task_title, task_description, template_key, suggested_message
    ) values (
      p_participant_id, first_attendance.host_organization_id, first_attendance.id, 'FIRST_ATTENDANCE',
      'first-attendance:' || p_participant_id, first_attendance.ends_at + interval '24 hours', 'PENDING',
      'First attendance follow-up', 'Reach out after the participant’s first qualifying attendance.', 'first-attendance-v1',
      public.phase6_default_follow_up_message('FIRST_ATTENDANCE', first_attendance.first_name, first_attendance.name, first_attendance.organization_name)
    );
  elsif task.status = 'PENDING' and task.event_id is distinct from first_attendance.id then
    update public.follow_up_tasks
    set organization_id = first_attendance.host_organization_id, event_id = first_attendance.id,
        due_at = first_attendance.ends_at + interval '24 hours', status = 'PENDING', completed_at = null,
        completed_by_admin_id = null, completion_outcome = null,
        completion_notes = 'Reopened by attendance reconciliation.',
        suggested_message = public.phase6_default_follow_up_message('FIRST_ATTENDANCE', first_attendance.first_name, first_attendance.name, first_attendance.organization_name)
    where id = task.id;
  end if;

  for r in
    select r0.id as registration_id, e.id as event_id, e.name, e.ends_at, e.host_organization_id,
           p.first_name, o.name as organization_name
    from public.attendance a
    join public.registrations r0 on r0.id = a.registration_id
    join public.events e on e.id = r0.event_id
    join public.participants p on p.id = r0.participant_id
    join public.organizations o on o.id = e.host_organization_id
    where r0.participant_id = p_participant_id
      and r0.registration_status = 'REGISTERED'
      and r0.registration_outcome = 'ACTIVE'
      and e.status <> 'CANCELLED'
      and a.status = 'NO_SHOW'
      and a.finalized_at is not null
  loop
    select * into task from public.follow_up_tasks where trigger_key = 'no-show:' || r.registration_id for update;
    if task.id is null then
      insert into public.follow_up_tasks (
        participant_id, organization_id, event_id, reason, trigger_key, due_at, status,
        task_title, task_description, template_key, suggested_message
      ) values (
        p_participant_id, r.host_organization_id, r.event_id, 'NO_SHOW', 'no-show:' || r.registration_id,
        r.ends_at + interval '24 hours', 'PENDING', 'No-show follow-up', 'Reach out after a finalized no-show.',
        'no-show-v1', public.phase6_default_follow_up_message('NO_SHOW', r.first_name, r.name, r.organization_name)
      );
    elsif task.status <> 'PENDING' then
      update public.follow_up_tasks
      set status = 'PENDING', completed_at = null, completed_by_admin_id = null,
          completion_outcome = null, completion_notes = 'Reopened by attendance reconciliation.'
      where id = task.id;
    end if;
  end loop;

  for task in select * from public.follow_up_tasks where participant_id = p_participant_id and reason = 'NO_SHOW' and status = 'PENDING' loop
    if not exists (
      select 1 from public.attendance a join public.registrations r0 on r0.id = a.registration_id
      join public.events e on e.id = r0.event_id
      where r0.id::text = split_part(task.trigger_key, ':', 2)
        and a.status = 'NO_SHOW' and a.finalized_at is not null and e.status <> 'CANCELLED'
    ) then
      update public.follow_up_tasks
      set status = 'DISMISSED', completed_at = now(), completed_by_admin_id = coalesce(actor, completed_by_admin_id),
          completion_notes = 'Attendance was corrected and the no-show is no longer valid.'
      where id = task.id;
    end if;
  end loop;
end;
$$;

create or replace function public.phase6_attendance_follow_up_trigger()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare participant_id uuid;
begin
  select r.participant_id into participant_id from public.registrations r where r.id = new.registration_id;
  perform public.phase6_reconcile_follow_up_tasks(participant_id);
  return new;
end;
$$;

drop trigger if exists attendance_follow_up_reconciliation on public.attendance;
create trigger attendance_follow_up_reconciliation
after insert or update on public.attendance
for each row execute function public.phase6_attendance_follow_up_trigger();

create or replace function public.phase6_search_participants(p_query text, p_limit integer default 50)
returns table (id uuid, first_name text, last_name text, display_phone text, email text, primary_affiliation_organization_id uuid, status public.participant_status)
language plpgsql security definer set search_path = public, auth as $$
declare q text := lower(btrim(coalesce(p_query, ''))); bounded_limit integer := least(greatest(coalesce(p_limit, 50), 1), 50);
begin
  if not public.is_active_system_admin() then raise exception 'participant unavailable' using errcode = '42501'; end if;
  if char_length(q) < 2 then return; end if;
  return query select p.id, p.first_name, p.last_name, p.display_phone, p.email,
    p.primary_affiliation_organization_id, p.status
  from public.participants p
  where p.status = 'ACTIVE' and (
    p.normalized_first_name like q || '%' or p.normalized_last_name like q || '%' or
    p.normalized_phone like '%' || q || '%' or p.normalized_email like q || '%'
  ) order by p.last_name, p.first_name limit bounded_limit;
end;
$$;

create or replace function public.phase6_update_follow_up_task(
  p_task_id uuid, p_suggested_message text default null
)
returns public.follow_up_tasks language plpgsql security definer set search_path = public, auth as $$
declare result public.follow_up_tasks%rowtype;
begin
  if not public.is_active_system_admin() then raise exception 'task unavailable' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_suggested_message, ''))) = 0 then raise exception 'message is required' using errcode = '22023'; end if;
  if char_length(p_suggested_message) > 2000 then raise exception 'message is too long' using errcode = '22023'; end if;
  update public.follow_up_tasks set suggested_message = coalesce(p_suggested_message, suggested_message)
  where id = p_task_id and status = 'PENDING' returning * into result;
  if not found then raise exception 'task unavailable' using errcode = '42501'; end if;
  insert into public.audit_events(actor_admin_id, action, entity_type, entity_id, new_values)
    values (auth.uid(), 'FOLLOW_UP_MESSAGE_UPDATED', 'FOLLOW_UP_TASK', p_task_id, jsonb_build_object('message_updated', true));
  return result;
end;
$$;

create or replace function public.phase6_record_follow_up_copy(p_task_id uuid)
returns public.follow_up_tasks language plpgsql security definer set search_path = public, auth as $$
declare result public.follow_up_tasks%rowtype;
begin
  if not public.is_active_system_admin() then raise exception 'task unavailable' using errcode = '42501'; end if;
  update public.follow_up_tasks set copied_at = now(), copied_by_admin_id = auth.uid()
  where id = p_task_id returning * into result;
  if not found then raise exception 'task unavailable' using errcode = '42501'; end if;
  insert into public.audit_events(actor_admin_id, action, entity_type, entity_id, new_values)
    values (auth.uid(), 'FOLLOW_UP_MESSAGE_COPIED', 'FOLLOW_UP_TASK', p_task_id, jsonb_build_object('template_key', result.template_key));
  return result;
end;
$$;

create or replace function public.phase6_complete_follow_up_task(p_task_id uuid, p_outcome text, p_notes text default null)
returns public.follow_up_tasks language plpgsql security definer set search_path = public, auth as $$
declare result public.follow_up_tasks%rowtype;
begin
  if not public.is_active_system_admin() then raise exception 'task unavailable' using errcode = '42501'; end if;
  if p_outcome not in ('CONTACTED', 'NO_RESPONSE', 'FOLLOW_UP_NOT_NEEDED', 'WRONG_CONTACT_INFORMATION') then raise exception 'invalid completion outcome' using errcode = '22023'; end if;
  update public.follow_up_tasks set status = 'COMPLETED', completed_at = now(), completed_by_admin_id = auth.uid(),
    completion_outcome = p_outcome, completion_notes = nullif(left(btrim(coalesce(p_notes, '')), 500), '')
  where id = p_task_id and status = 'PENDING' returning * into result;
  if not found then raise exception 'task unavailable' using errcode = '42501'; end if;
  insert into public.audit_events(actor_admin_id, action, entity_type, entity_id, reason, new_values)
    values (auth.uid(), 'FOLLOW_UP_TASK_COMPLETED', 'FOLLOW_UP_TASK', p_task_id, p_outcome, jsonb_build_object('outcome', p_outcome));
  return result;
end;
$$;

create or replace function public.phase6_dismiss_follow_up_task(p_task_id uuid, p_reason text)
returns public.follow_up_tasks language plpgsql security definer set search_path = public, auth as $$
declare result public.follow_up_tasks%rowtype;
begin
  if not public.is_active_system_admin() then raise exception 'task unavailable' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'reason is required' using errcode = '22023'; end if;
  update public.follow_up_tasks set status = 'DISMISSED', completed_at = now(), completed_by_admin_id = auth.uid(),
    completion_notes = left(btrim(p_reason), 500)
  where id = p_task_id and status = 'PENDING' returning * into result;
  if not found then raise exception 'task unavailable' using errcode = '42501'; end if;
  insert into public.audit_events(actor_admin_id, action, entity_type, entity_id, reason)
    values (auth.uid(), 'FOLLOW_UP_TASK_DISMISSED', 'FOLLOW_UP_TASK', p_task_id, left(btrim(p_reason), 500));
  return result;
end;
$$;

create or replace function public.phase6_assign_follow_up_task(p_task_id uuid, p_assigned_admin_id uuid)
returns public.follow_up_tasks language plpgsql security definer set search_path = public, auth as $$
declare result public.follow_up_tasks%rowtype; target_role public.admin_role; target_status public.admin_status;
begin
  if not public.is_active_system_admin() then raise exception 'task unavailable' using errcode = '42501'; end if;
  select role, status into target_role, target_status from public.admin_profiles where id = p_assigned_admin_id;
  if target_status <> 'ACTIVE' or target_role not in ('SYSTEM_ADMIN', 'HOST_ADMIN') then raise exception 'assignee unavailable' using errcode = '42501'; end if;
  update public.follow_up_tasks set assigned_admin_id = p_assigned_admin_id where id = p_task_id returning * into result;
  if not found then raise exception 'task unavailable' using errcode = '42501'; end if;
  if target_role = 'HOST_ADMIN' and not exists (
    select 1 from public.admin_organization_assignments a where a.admin_profile_id = p_assigned_admin_id
      and a.organization_id = result.organization_id and a.revoked_at is null
  ) then raise exception 'assignee unavailable' using errcode = '42501'; end if;
  insert into public.audit_events(actor_admin_id, action, entity_type, entity_id, new_values)
    values (auth.uid(), 'FOLLOW_UP_TASK_ASSIGNED', 'FOLLOW_UP_TASK', p_task_id, jsonb_build_object('assigned_admin_id', p_assigned_admin_id));
  return result;
end;
$$;

revoke all on function public.phase6_reconcile_follow_up_tasks(uuid) from public;
revoke all on function public.phase6_search_participants(text, integer) from public;
revoke all on function public.phase6_update_follow_up_task(uuid, text) from public;
revoke all on function public.phase6_record_follow_up_copy(uuid) from public;
revoke all on function public.phase6_complete_follow_up_task(uuid, text, text) from public;
revoke all on function public.phase6_dismiss_follow_up_task(uuid, text) from public;
revoke all on function public.phase6_assign_follow_up_task(uuid, uuid) from public;
grant execute on function public.phase6_search_participants(text, integer) to authenticated;
grant execute on function public.phase6_update_follow_up_task(uuid, text) to authenticated;
grant execute on function public.phase6_record_follow_up_copy(uuid) to authenticated;
grant execute on function public.phase6_complete_follow_up_task(uuid, text, text) to authenticated;
grant execute on function public.phase6_dismiss_follow_up_task(uuid, text) to authenticated;
grant execute on function public.phase6_assign_follow_up_task(uuid, uuid) to authenticated;
