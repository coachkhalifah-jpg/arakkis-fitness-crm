-- Allow scoped Host Admins to correct finalized attendance while keeping
-- whole-event reopening System Admin-only.

create or replace function public.phase5_mark_attendance(
  p_registration_id uuid,
  p_status public.attendance_status,
  p_reason text default null
)
returns public.attendance
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  registration_row public.registrations%rowtype;
  e public.events%rowtype;
  a public.attendance%rowtype;
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select regs.* into registration_row
  from public.registrations regs
  where regs.id = p_registration_id
  for update;
  if not found or not public.has_event_access(registration_row.event_id) then
    raise exception 'registration unavailable' using errcode = '42501';
  end if;

  select event_row.* into e
  from public.events event_row
  where event_row.id = registration_row.event_id
  for update;
  if e.status in ('DRAFT', 'CANCELLED') then
    raise exception 'event unavailable' using errcode = '42501';
  end if;
  if e.attendance_processing_state not in ('OPEN', 'REOPENED', 'FINALIZED') then
    raise exception 'attendance is not open' using errcode = '42501';
  end if;
  if registration_row.registration_status = 'CANCELLED'
     and p_status in ('ATTENDED', 'NO_SHOW') then
    raise exception 'registration unavailable' using errcode = '42501';
  end if;
  if p_status = 'NO_SHOW' and e.attendance_processing_state <> 'FINALIZED' then
    raise exception 'no-show requires finalization' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) = 0
     and e.attendance_processing_state in ('REOPENED', 'FINALIZED') then
    raise exception 'correction reason is required' using errcode = '22023';
  end if;

  select * into a
  from public.attendance
  where registration_id = p_registration_id
  for update;
  if not found then
    insert into public.attendance(
      registration_id, status, checked_in_at, finalized_at, updated_by_admin_id
    )
    values (
      p_registration_id,
      p_status,
      case when p_status = 'ATTENDED' then now() end,
      case when e.attendance_processing_state = 'FINALIZED' then now() end,
      actor
    )
    returning * into a;
  else
    update public.attendance
    set status = p_status,
        checked_in_at = case
          when p_status = 'ATTENDED' then coalesce(checked_in_at, now())
          else null
        end,
        finalized_at = case
          when e.attendance_processing_state = 'FINALIZED' then coalesce(finalized_at, now())
          else finalized_at
        end,
        updated_by_admin_id = actor,
        updated_at = now()
    where id = a.id
    returning * into a;
  end if;

  insert into public.audit_events(
    actor_admin_id, action, entity_type, entity_id, reason, old_values, new_values
  )
  values (
    actor,
    case when p_status = 'NO_SHOW' then 'ATTENDANCE_NO_SHOW_RECORDED' else 'ATTENDANCE_MARKED' end,
    'ATTENDANCE',
    a.id,
    nullif(btrim(p_reason), ''),
    jsonb_build_object('registration_id', p_registration_id),
    jsonb_build_object('status', p_status)
  );
  return a;
end;
$$;

create or replace function public.phase5_save_attendance_changes(
  p_event_id uuid,
  p_changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  change jsonb;
  registration_id uuid;
  status public.attendance_status;
  reason text;
  changed integer := 0;
  e public.events%rowtype;
begin
  e := public.phase5_require_event(p_event_id);
  if e.attendance_processing_state not in ('OPEN', 'REOPENED', 'FINALIZED') then
    raise exception 'attendance is not open' using errcode = '42501';
  end if;
  if jsonb_typeof(p_changes) <> 'array' then
    raise exception 'attendance changes are invalid' using errcode = '22023';
  end if;

  for change in select value from jsonb_array_elements(p_changes)
  loop
    registration_id := (change->>'registration_id')::uuid;
    status := (change->>'status')::public.attendance_status;
    reason := nullif(btrim(change->>'reason'), '');
    if not exists (
      select 1 from public.registrations
      where id = registration_id and event_id = p_event_id
    ) then
      raise exception 'registration unavailable' using errcode = '42501';
    end if;
    perform public.phase5_mark_attendance(registration_id, status, reason);
    changed := changed + 1;
  end loop;
  return jsonb_build_object('changed', changed);
end;
$$;

-- Host Admins cannot read the versioned legal-document table directly. Expose
-- only the current IDs needed by the already-authorized walk-in workflow.
create or replace function public.phase5_current_acknowledgment_version(
  p_type public.acknowledgment_type
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  version_id uuid;
begin
  if p_type not in ('PARTICIPATION_RISK', 'DATA_USE') then
    raise exception 'acknowledgment type unavailable' using errcode = '42501';
  end if;
  select id into version_id
  from public.acknowledgment_versions
  where type = p_type
    and legal_status in ('APPROVED', 'PROVISIONAL')
    and effective_at <= now()
    and retired_at is null
  order by version desc
  limit 1;
  if version_id is null then
    raise exception 'acknowledgment version unavailable' using errcode = '22023';
  end if;
  return version_id;
end;
$$;

revoke all on function public.phase5_current_acknowledgment_version(public.acknowledgment_type) from public;
grant execute on function public.phase5_current_acknowledgment_version(public.acknowledgment_type) to authenticated;
