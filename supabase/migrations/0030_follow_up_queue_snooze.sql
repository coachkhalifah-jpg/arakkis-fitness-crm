-- Follow-up engagement queue: auditable snoozing for open tasks.

create or replace function public.phase6_snooze_follow_up_task(
  p_task_id uuid,
  p_due_at timestamptz
)
returns public.follow_up_tasks language plpgsql security definer set search_path = public, auth as $$
declare
  result public.follow_up_tasks%rowtype;
  previous_due_at timestamptz;
begin
  if not public.is_active_system_admin() then
    raise exception 'task unavailable' using errcode = '42501';
  end if;
  if p_due_at is null or p_due_at <= now() then
    raise exception 'invalid snooze date' using errcode = '22023';
  end if;

  select due_at into previous_due_at
  from public.follow_up_tasks
  where id = p_task_id and status = 'PENDING'
  for update;

  if previous_due_at is null then
    raise exception 'task unavailable' using errcode = '42501';
  end if;

  update public.follow_up_tasks
  set due_at = p_due_at
  where id = p_task_id
  returning * into result;

  insert into public.audit_events(actor_admin_id, action, entity_type, entity_id, old_values, new_values)
    values (
      auth.uid(),
      'FOLLOW_UP_TASK_SNOOZED',
      'FOLLOW_UP_TASK',
      p_task_id,
      jsonb_build_object('due_at', previous_due_at),
      jsonb_build_object('due_at', p_due_at)
    );
  return result;
end;
$$;

revoke all on function public.phase6_snooze_follow_up_task(uuid, timestamptz) from public;
grant execute on function public.phase6_snooze_follow_up_task(uuid, timestamptz) to authenticated;
