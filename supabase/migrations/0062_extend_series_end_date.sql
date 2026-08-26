-- Extend a recurring series and materialize only newly eligible occurrences.
-- Stopped/superseded schedule history is preserved and is never revived.

create or replace function public.phase3_extend_series_end_date(
  p_request_id uuid,
  p_series_id uuid,
  p_new_ends_on date,
  p_actor_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  series_row public.event_series%rowtype;
  old_ends_on date;
  active_rule_ids uuid[] := '{}'::uuid[];
  existing_occurrence_count integer;
  new_occurrence_count integer;
  generated jsonb;
  result jsonb;
  existing_audit public.audit_events%rowtype;
  canonical jsonb;
  fingerprint text;
  rule_id uuid;
begin
  if p_actor_admin_id is null or p_actor_admin_id is distinct from auth.uid()
     or not public.is_active_system_admin() then
    raise exception 'series extension requires an active System Admin' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'series extension request id is required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));

  canonical := jsonb_build_object(
    'operation', 'EXTEND_SERIES_END',
    'series_id', p_series_id,
    'new_ends_on', p_new_ends_on,
    'actor_admin_id', p_actor_admin_id
  );
  fingerprint := encode(extensions.digest(canonical::text, 'sha256'), 'hex');
  select * into existing_audit
  from public.audit_events
  where request_id = p_request_id::text
    and action = 'SERIES_END_EXTENDED'
  limit 1;
  if found then
    if existing_audit.actor_admin_id is distinct from p_actor_admin_id
       or existing_audit.reason is distinct from fingerprint then
      raise exception 'series extension request was reused with different inputs' using errcode = '42501';
    end if;
    return coalesce(existing_audit.new_values, '{}'::jsonb) || jsonb_build_object('idempotent', true);
  end if;

  select * into series_row
  from public.event_series
  where id = p_series_id
  for update;
  if not found then raise exception 'event series was not found' using errcode = 'P0002'; end if;
  old_ends_on := series_row.ends_on;
  if p_new_ends_on is null or p_new_ends_on <= old_ends_on then
    raise exception 'the new series end date must be after the current series end date' using errcode = '22023';
  end if;

  -- A rule ending exactly at the old series boundary is still active only
  -- when it has no successor and no explicit stop audit at that boundary.
  select coalesce(array_agg(r.id), '{}'::uuid[])
  into active_rule_ids
  from public.event_series_schedule_rules r
  where r.event_series_id = p_series_id
    and r.effective_end_date = old_ends_on
    and not exists (
      select 1 from public.event_series_schedule_rules successor
      where successor.supersedes_rule_id = r.id
    )
    and not exists (
      select 1 from public.audit_events stopped
      where stopped.entity_type = 'EVENT_SERIES_SCHEDULE_RULE'
        and stopped.entity_id = r.id
        and stopped.action = 'SCHEDULE_RULE_STOPPED'
        and (stopped.new_values ->> 'effective_end_date')::date = old_ends_on
    );

  select count(*) into existing_occurrence_count
  from public.events
  where event_series_id = p_series_id;

  select count(*) into new_occurrence_count
  from public.event_series_schedule_rules r
  cross join lateral generate_series(old_ends_on + 1, p_new_ends_on, interval '1 day') dates(day)
  where r.id = any(active_rule_ids)
    and extract(isodow from dates.day) = r.weekday;
  if existing_occurrence_count + new_occurrence_count > 104 then
    raise exception 'extending the series would exceed the 104 occurrence limit' using errcode = '22023';
  end if;

  perform set_config('app.recurrence_request_id', p_request_id::text, true);
  perform set_config('app.recurrence_defer_audit', 'on', true);
  perform set_config('app.recurrence_audit_context', jsonb_build_object(
    'request_id', p_request_id,
    'actor_admin_id', p_actor_admin_id,
    'series_id', p_series_id,
    'previous_ends_on', old_ends_on,
    'new_ends_on', p_new_ends_on,
    'logical_input_fingerprint', fingerprint
  )::text, true);

  update public.event_series
  set ends_on = p_new_ends_on
  where id = p_series_id;
  update public.event_series_schedule_rules
  set effective_end_date = p_new_ends_on
  where id = any(active_rule_ids);

  new_occurrence_count := 0;
  for rule_id in select unnest(active_rule_ids) loop
    if exists (
      select 1
      from generate_series(old_ends_on + 1, p_new_ends_on, interval '1 day') dates(day)
      where extract(isodow from dates.day) = (
        select weekday from public.event_series_schedule_rules where id = rule_id
      )
    ) then
      generated := public.phase3_materialize_schedule_rule(rule_id, p_actor_admin_id);
      new_occurrence_count := new_occurrence_count + coalesce((generated ->> 'occurrence_count')::integer, 0);
    end if;
  end loop;

  result := jsonb_build_object(
    'series_id', p_series_id,
    'previous_ends_on', old_ends_on,
    'new_ends_on', p_new_ends_on,
    'occurrence_count', new_occurrence_count,
    'series_extended', true,
    'idempotent', false
  );
  insert into public.audit_events (
    actor_admin_id, action, entity_type, entity_id, old_values, new_values, request_id, reason
  ) values (
    p_actor_admin_id, 'SERIES_END_EXTENDED', 'EVENT_SERIES', p_series_id,
    jsonb_build_object('ends_on', old_ends_on),
    result || jsonb_build_object('logical_inputs', canonical),
    p_request_id::text, fingerprint
  );
  return result;
end;
$$;

revoke all on function public.phase3_extend_series_end_date(uuid, uuid, date, uuid) from public, anon;
grant execute on function public.phase3_extend_series_end_date(uuid, uuid, date, uuid) to authenticated;
