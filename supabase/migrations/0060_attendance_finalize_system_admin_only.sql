-- Attendance finalization is a system-wide state transition.  Keep the
-- existing scoped Host Admin access for check-in/correction operations, but
-- enforce finalization authorization inside the SECURITY DEFINER RPC before
-- any event lookup or idempotent return.
create or replace function public.phase5_finalize_attendance(p_event_id uuid)
returns public.events
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  e public.events%rowtype;
  r public.registrations%rowtype;
  a public.attendance%rowtype;
  actor uuid := auth.uid();
begin
  if not public.is_active_system_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  e := public.phase5_require_event(p_event_id);
  if e.attendance_processing_state = 'FINALIZED' then
    return e;
  end if;
  if e.attendance_processing_state not in ('OPEN', 'REOPENED') then
    raise exception 'attendance is not open' using errcode = '42501';
  end if;

  for r in
    select *
    from public.registrations
    where event_id = p_event_id
      and registration_status = 'REGISTERED'
      and registration_outcome = 'ACTIVE'
    for update
  loop
    select * into a
    from public.attendance
    where registration_id = r.id
    for update;
    if not found then
      insert into public.attendance(
        registration_id, status, finalized_at, updated_by_admin_id
      )
      values (r.id, 'NO_SHOW', now(), actor);
    elsif a.status = 'NOT_RECORDED' then
      update public.attendance
      set status = 'NO_SHOW',
          finalized_at = now(),
          updated_by_admin_id = actor,
          updated_at = now()
      where id = a.id;
    end if;
  end loop;

  update public.events
  set attendance_processing_state = 'FINALIZED'
  where id = p_event_id
  returning * into e;

  insert into public.audit_events(
    actor_admin_id, action, entity_type, entity_id, new_values
  )
  values (
    actor, 'ATTENDANCE_FINALIZED', 'EVENT', p_event_id,
    jsonb_build_object('state', 'FINALIZED')
  );
  return e;
end;
$$;

revoke all on function public.phase5_finalize_attendance(uuid) from public;
grant execute on function public.phase5_finalize_attendance(uuid) to authenticated;
