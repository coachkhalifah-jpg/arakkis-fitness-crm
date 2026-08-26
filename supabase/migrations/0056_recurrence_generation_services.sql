-- Slice B: atomic recurrence generation and prospective schedule mutation.
-- This migration intentionally leaves the Slice A schema and existing event
-- creation RPC intact. These functions materialize additional occurrences only.

drop index if exists public.audit_schedule_mutation_request_uq;
create index if not exists audit_schedule_mutation_request_idx
  on public.audit_events (request_id)
  where request_id is not null
    and action in ('SCHEDULE_RULE_CREATED', 'SCHEDULE_RULE_CHANGED', 'SCHEDULE_RULE_STOPPED');

create or replace function public.audit_event_series_schedule_rule_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor uuid;
  action_name text;
  request_identity text := nullif(current_setting('app.recurrence_request_id', true), '');
  context jsonb := case
    when nullif(current_setting('app.recurrence_audit_context', true), '') is null then '{}'::jsonb
    else current_setting('app.recurrence_audit_context', true)::jsonb
  end;
begin
  if current_setting('app.recurrence_defer_audit', true) = 'on' then
    return coalesce(new, old);
  end if;
  select id into actor
  from public.admin_profiles
  where id = auth.uid() and status = 'ACTIVE';

  if actor is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    action_name := 'SCHEDULE_RULE_CREATED';
    insert into public.audit_events (
      actor_admin_id, action, entity_type, entity_id, new_values, request_id
    ) values (
      actor, action_name, 'EVENT_SERIES_SCHEDULE_RULE', new.id,
      to_jsonb(new) || context, request_identity
    );
    return new;
  end if;

  action_name := case
    when old.effective_end_date is null and new.effective_end_date is not null
      then 'SCHEDULE_RULE_STOPPED'
    else 'SCHEDULE_RULE_CHANGED'
  end;
  insert into public.audit_events (
    actor_admin_id, action, entity_type, entity_id, old_values, new_values, request_id
  ) values (
    actor, action_name, 'EVENT_SERIES_SCHEDULE_RULE', new.id,
    to_jsonb(old), to_jsonb(new) || context, request_identity
  );
  return new;
end;
$$;

-- Materialize one rule. The caller owns the transaction and has already
-- validated the mutation request and authorization.
create or replace function public.phase3_materialize_schedule_rule(
  p_rule_id uuid,
  p_actor_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  rule_row public.event_series_schedule_rules%rowtype;
  series_row public.event_series%rowtype;
  template public.events%rowtype;
  occurrence_date date;
  today_local date;
  local_start timestamp without time zone;
  local_end timestamp without time zone;
  starts_at timestamptz;
  ends_at timestamptz;
  deadline_at timestamptz;
  opens_at timestamptz;
  closes_at timestamptz;
  occurrence_id uuid;
  next_occurrence_number integer;
  generated_ids uuid[] := '{}'::uuid[];
  generated_count integer := 0;
  deadline_offset interval;
  opens_offset interval;
  closes_offset interval;
  template_start_local timestamp without time zone;
  template_timezone text;
begin
  if p_actor_admin_id is null or p_actor_admin_id is distinct from auth.uid()
     or not public.is_active_system_admin() then
    raise exception 'schedule generation requires an active System Admin' using errcode = '42501';
  end if;

  select * into rule_row
  from public.event_series_schedule_rules
  where id = p_rule_id
  for update;
  if not found then
    raise exception 'schedule rule was not found' using errcode = 'P0002';
  end if;

  select * into series_row
  from public.event_series
  where id = rule_row.event_series_id
  for update;
  if not found then
    raise exception 'event series was not found' using errcode = 'P0002';
  end if;

  -- The earliest occurrence is the canonical template. Conflicting values
  -- indicate occurrence-level overrides that cannot safely become defaults.
  select * into template
  from public.events
  where event_series_id = series_row.id
  order by coalesce(series_occurrence_number, 2147483647), starts_at, id
  limit 1;
  if not found then
    raise exception 'event series has no canonical occurrence template' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organizations o
    join public.venues v on v.id = template.venue_id
    where o.id = template.host_organization_id
      and o.active_status = 'ACTIVE'
      and v.active_status = 'ACTIVE'
      and (v.organization_id is null or v.organization_id = o.id)
  ) then
    raise exception 'series Organization or Venue is no longer valid' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.events e
    where e.event_series_id = series_row.id
      and (
        e.host_organization_id is distinct from template.host_organization_id
        or e.venue_id is distinct from template.venue_id
        or e.name is distinct from template.name
        or e.description is distinct from template.description
        or e.participant_instructions is distinct from template.participant_instructions
        or e.timezone is distinct from template.timezone
        or e.capacity is distinct from template.capacity
        or e.visibility is distinct from template.visibility
        or e.access_mode is distinct from template.access_mode
        or e.communication_url is distinct from template.communication_url
        or e.communication_label is distinct from template.communication_label
        or e.event_title_color is distinct from template.event_title_color
      )
  ) then
    raise exception 'series occurrences contain conflicting default values' using errcode = '22023';
  end if;

  template_timezone := template.timezone;
  today_local := (now() at time zone template_timezone)::date;
  template_start_local := template.starts_at at time zone template_timezone;
  -- Registration windows are series defaults relative to the canonical
  -- occurrence start, so a schedule at a different time keeps the same
  -- participant-facing lead/close intervals.
  deadline_offset := (template.registration_deadline at time zone template_timezone) - template_start_local;
  opens_offset := case when template.registration_opens_at is null then null else
    (template.registration_opens_at at time zone template_timezone) - template_start_local end;
  closes_offset := case when template.registration_closes_at is null then null else
    (template.registration_closes_at at time zone template_timezone) - template_start_local end;

  select coalesce(max(series_occurrence_number), 0) + 1
    into next_occurrence_number
  from public.events
  where event_series_id = series_row.id;

  for occurrence_date in
    select d::date
    from generate_series(
      rule_row.effective_start_date::timestamp,
      coalesce(rule_row.effective_end_date, series_row.ends_on)::timestamp,
      interval '1 day'
    ) as dates(d)
    where extract(isodow from d) = rule_row.weekday
      and d::date <= series_row.ends_on
      and d::date >= today_local
    order by d
  loop
    local_start := occurrence_date + rule_row.local_start_time;
    local_end := occurrence_date + rule_row.local_end_time;

    -- PostgreSQL rejects neither every nonexistent DST local time nor every
    -- timezone edge consistently across versions. Round-trip validation makes
    -- the stored local-date provenance fail closed for nonexistent times.
    if ((local_start at time zone template_timezone) at time zone template_timezone) <> local_start
       or ((local_end at time zone template_timezone) at time zone template_timezone) <> local_end then
      raise exception 'schedule contains a local time that does not exist in the Venue timezone' using errcode = '22023';
    end if;

    starts_at := local_start at time zone template_timezone;
    ends_at := local_end at time zone template_timezone;
    if starts_at <= now() then
      continue;
    end if;

    -- Existing materialized occurrences remain authoritative. This also
    -- handles legacy rows whose generated_local_date was not backfilled.
    if exists (
      select 1 from public.events e
      where e.event_series_id = series_row.id
        and coalesce(e.generated_local_date, (e.starts_at at time zone template_timezone)::date) = occurrence_date
    ) then
      continue;
    end if;

    deadline_at := starts_at + deadline_offset;
    opens_at := case when opens_offset is null then null else starts_at + opens_offset end;
    closes_at := case when closes_offset is null then null else starts_at + closes_offset end;
    if deadline_at > starts_at or (opens_at is not null and opens_at >= starts_at)
       or (opens_at is not null and closes_at is not null and closes_at <= opens_at) then
      raise exception 'canonical series registration window cannot be propagated safely' using errcode = '22023';
    end if;

    occurrence_id := gen_random_uuid();
    insert into public.events (
      id, event_series_id, series_occurrence_number, host_organization_id, venue_id,
      name, description, participant_instructions, event_title_color, starts_at, ends_at,
      timezone, capacity, registration_deadline, status, visibility, access_mode,
      communication_url, communication_label, publication_status, public_slug,
      registration_opens_at, registration_closes_at, registration_paused_at,
      last_published_at, published_by_admin_id, created_by_admin_id,
      schedule_rule_id, generated_local_date
    ) values (
      occurrence_id, series_row.id, next_occurrence_number, template.host_organization_id,
      template.venue_id, template.name, template.description, template.participant_instructions,
      template.event_title_color, starts_at, ends_at, template.timezone, template.capacity,
      deadline_at, template.status, template.visibility, template.access_mode,
      template.communication_url, template.communication_label, template.publication_status,
      null, opens_at, closes_at, null, template.last_published_at, template.published_by_admin_id,
      p_actor_admin_id, rule_row.id, occurrence_date
    );
    generated_ids := array_append(generated_ids, occurrence_id);
    generated_count := generated_count + 1;
    next_occurrence_number := next_occurrence_number + 1;
  end loop;

  if generated_count = 0 then
    raise exception 'the schedule has no valid future occurrences remaining' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'rule_id', rule_row.id,
    'series_id', series_row.id,
    'occurrence_ids', to_jsonb(generated_ids),
    'occurrence_count', generated_count
  );
end;
$$;

create or replace function public.phase3_add_schedule_rule(
  p_request_id uuid,
  p_series_id uuid,
  p_weekday smallint,
  p_local_start_time time,
  p_local_end_time time,
  p_effective_start_date date,
  p_actor_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  series_row public.event_series%rowtype;
  template public.events%rowtype;
  effective_date date := p_effective_start_date;
  today_local date;
  local_weekday integer;
  days_until integer;
  canonical jsonb;
  fingerprint text;
  existing_audit public.audit_events%rowtype;
  rule_id uuid;
  result jsonb;
begin
  if p_actor_admin_id is null or p_actor_admin_id is distinct from auth.uid()
     or not public.is_active_system_admin() then
    raise exception 'schedule mutation requires an active System Admin' using errcode = '42501';
  end if;
  if p_request_id is null then raise exception 'schedule mutation request id is required' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));

  canonical := jsonb_build_object(
    'operation', 'ADD', 'series_id', p_series_id, 'weekday', p_weekday,
    'local_start_time', p_local_start_time, 'local_end_time', p_local_end_time,
    'effective_start_date', p_effective_start_date, 'actor_admin_id', p_actor_admin_id
  );
  fingerprint := encode(extensions.digest(canonical::text, 'sha256'), 'hex');
  select * into existing_audit from public.audit_events
  where request_id = p_request_id::text
    and action in ('SCHEDULE_RULE_CREATED', 'SCHEDULE_RULE_CHANGED', 'SCHEDULE_RULE_STOPPED')
  limit 1;
  if found then
    if existing_audit.actor_admin_id is distinct from p_actor_admin_id or existing_audit.reason is distinct from fingerprint then
      raise exception 'schedule request was reused with different inputs' using errcode = '42501';
    end if;
    return coalesce(existing_audit.new_values, '{}'::jsonb) || jsonb_build_object('idempotent', true);
  end if;

  select * into series_row from public.event_series where id = p_series_id for update;
  if not found then raise exception 'event series was not found' using errcode = 'P0002'; end if;
  select * into template from public.events where event_series_id = p_series_id
    order by coalesce(series_occurrence_number, 2147483647), starts_at, id limit 1;
  if not found then raise exception 'event series has no occurrence template' using errcode = '22023'; end if;
  if p_weekday not between 1 and 7 or p_local_end_time <= p_local_start_time then
    raise exception 'schedule day and time are invalid' using errcode = '22023';
  end if;
  today_local := (now() at time zone template.timezone)::date;
  if effective_date is null then
    effective_date := today_local;
    local_weekday := extract(isodow from effective_date);
    days_until := (p_weekday - local_weekday + 7) % 7;
    effective_date := effective_date + days_until;
    if days_until = 0 and p_local_start_time <= (now() at time zone template.timezone)::time then
      effective_date := effective_date + 7;
    end if;
  end if;
  if effective_date > series_row.ends_on then raise exception 'effective date is after the series end date' using errcode = '22023'; end if;
  if exists (
    select 1 from public.event_series_schedule_rules r
    where r.event_series_id = p_series_id and r.weekday = p_weekday
      and r.effective_start_date <= coalesce(r.effective_end_date, series_row.ends_on)
      and effective_date <= coalesce(r.effective_end_date, series_row.ends_on)
      and r.effective_start_date <= series_row.ends_on
  ) then
    raise exception 'the schedule overlaps an existing schedule rule' using errcode = '23505';
  end if;

  perform set_config('app.recurrence_request_id', p_request_id::text, true);
  perform set_config('app.recurrence_defer_audit', 'on', true);
  perform set_config('app.recurrence_audit_context', jsonb_build_object(
    'request_id', p_request_id, 'actor_admin_id', p_actor_admin_id,
    'series_id', p_series_id, 'effective_start_date', effective_date,
    'effective_end_date', series_row.ends_on, 'logical_input_fingerprint', fingerprint
  )::text, true);
  insert into public.event_series_schedule_rules (
    event_series_id, weekday, local_start_time, local_end_time,
    effective_start_date, effective_end_date, created_by_admin_id
  ) values (
    p_series_id, p_weekday, p_local_start_time, p_local_end_time,
    effective_date, series_row.ends_on, p_actor_admin_id
  ) returning id into rule_id;
  result := public.phase3_materialize_schedule_rule(rule_id, p_actor_admin_id);
  insert into public.audit_events (
    actor_admin_id, action, entity_type, entity_id, new_values, request_id, reason
  ) values (
    p_actor_admin_id, 'SCHEDULE_RULE_CREATED', 'EVENT_SERIES_SCHEDULE_RULE', rule_id,
    result || jsonb_build_object('logical_inputs', canonical), p_request_id::text, fingerprint
  );
  return result || jsonb_build_object('idempotent', false);
end;
$$;

create or replace function public.phase3_change_schedule_rule(
  p_request_id uuid,
  p_rule_id uuid,
  p_weekday smallint,
  p_local_start_time time,
  p_local_end_time time,
  p_effective_start_date date,
  p_actor_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  old_rule public.event_series_schedule_rules%rowtype;
  series_row public.event_series%rowtype;
  effective_date date := p_effective_start_date;
  canonical jsonb;
  fingerprint text;
  existing_audit public.audit_events%rowtype;
  successor_id uuid;
  result jsonb;
begin
  if p_actor_admin_id is null or p_actor_admin_id is distinct from auth.uid() or not public.is_active_system_admin() then
    raise exception 'schedule mutation requires an active System Admin' using errcode = '42501';
  end if;
  if p_request_id is null then raise exception 'schedule mutation request id is required' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  canonical := jsonb_build_object('operation', 'CHANGE', 'rule_id', p_rule_id, 'weekday', p_weekday,
    'local_start_time', p_local_start_time, 'local_end_time', p_local_end_time,
    'effective_start_date', p_effective_start_date, 'actor_admin_id', p_actor_admin_id);
  fingerprint := encode(extensions.digest(canonical::text, 'sha256'), 'hex');
  select * into existing_audit from public.audit_events where request_id = p_request_id::text
    and action in ('SCHEDULE_RULE_CREATED', 'SCHEDULE_RULE_CHANGED', 'SCHEDULE_RULE_STOPPED') limit 1;
  if found then
    if existing_audit.actor_admin_id is distinct from p_actor_admin_id or existing_audit.reason is distinct from fingerprint then
      raise exception 'schedule request was reused with different inputs' using errcode = '42501';
    end if;
    return coalesce(existing_audit.new_values, '{}'::jsonb) || jsonb_build_object('idempotent', true);
  end if;
  select * into old_rule from public.event_series_schedule_rules where id = p_rule_id for update;
  if not found then raise exception 'schedule rule was not found' using errcode = 'P0002'; end if;
  select * into series_row from public.event_series where id = old_rule.event_series_id for update;
  if p_weekday not between 1 and 7 or p_local_end_time <= p_local_start_time then raise exception 'schedule day and time are invalid' using errcode = '22023'; end if;
  if effective_date is null then raise exception 'an effective date is required for a schedule change' using errcode = '22023'; end if;
  if effective_date <= old_rule.effective_start_date or effective_date > series_row.ends_on then
    raise exception 'successor effective date must be after the current rule start and within the series' using errcode = '22023';
  end if;
  if old_rule.effective_end_date is not null and effective_date > old_rule.effective_end_date then
    raise exception 'successor effective date is after the current rule end date' using errcode = '22023';
  end if;
  if exists (select 1 from public.event_series_schedule_rules r
    where r.event_series_id = old_rule.event_series_id and r.id <> old_rule.id
      and r.weekday = p_weekday and r.effective_start_date <= series_row.ends_on
      and effective_date <= coalesce(r.effective_end_date, series_row.ends_on)
      and r.effective_start_date <= coalesce(old_rule.effective_end_date, series_row.ends_on)) then
    raise exception 'the successor schedule overlaps an existing schedule rule' using errcode = '23505';
  end if;

  perform set_config('app.recurrence_request_id', p_request_id::text, true);
  perform set_config('app.recurrence_defer_audit', 'on', true);
  perform set_config('app.recurrence_audit_context', jsonb_build_object('request_id', p_request_id,
    'actor_admin_id', p_actor_admin_id, 'series_id', old_rule.event_series_id,
    'effective_start_date', effective_date, 'effective_end_date', series_row.ends_on,
    'logical_input_fingerprint', fingerprint)::text, true);
  update public.event_series_schedule_rules
  set effective_end_date = effective_date - 1
  where id = old_rule.id;
  insert into public.event_series_schedule_rules (
    event_series_id, weekday, local_start_time, local_end_time, effective_start_date,
    effective_end_date, created_by_admin_id, supersedes_rule_id
  ) values (old_rule.event_series_id, p_weekday, p_local_start_time, p_local_end_time,
    effective_date, series_row.ends_on, p_actor_admin_id, old_rule.id)
  returning id into successor_id;
  result := public.phase3_materialize_schedule_rule(successor_id, p_actor_admin_id)
    || jsonb_build_object('previous_rule_id', old_rule.id);
  insert into public.audit_events (
    actor_admin_id, action, entity_type, entity_id, old_values, new_values, request_id, reason
  ) values
    (p_actor_admin_id, 'SCHEDULE_RULE_STOPPED', 'EVENT_SERIES_SCHEDULE_RULE', old_rule.id,
      to_jsonb(old_rule), to_jsonb((select r from public.event_series_schedule_rules r where r.id = old_rule.id)),
      p_request_id::text, fingerprint),
    (p_actor_admin_id, 'SCHEDULE_RULE_CREATED', 'EVENT_SERIES_SCHEDULE_RULE', successor_id,
      null, result || jsonb_build_object('logical_inputs', canonical), p_request_id::text, fingerprint);
  return result || jsonb_build_object('idempotent', false);
end;
$$;

create or replace function public.phase3_stop_schedule_rule(
  p_request_id uuid,
  p_rule_id uuid,
  p_effective_end_date date,
  p_actor_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  rule_row public.event_series_schedule_rules%rowtype;
  series_row public.event_series%rowtype;
  canonical jsonb;
  fingerprint text;
  existing_audit public.audit_events%rowtype;
  result jsonb;
begin
  if p_actor_admin_id is null or p_actor_admin_id is distinct from auth.uid() or not public.is_active_system_admin() then
    raise exception 'schedule mutation requires an active System Admin' using errcode = '42501';
  end if;
  if p_request_id is null then raise exception 'schedule mutation request id is required' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  canonical := jsonb_build_object('operation', 'STOP', 'rule_id', p_rule_id,
    'effective_end_date', p_effective_end_date, 'actor_admin_id', p_actor_admin_id);
  fingerprint := encode(extensions.digest(canonical::text, 'sha256'), 'hex');
  select * into existing_audit from public.audit_events where request_id = p_request_id::text
    and action in ('SCHEDULE_RULE_CREATED', 'SCHEDULE_RULE_CHANGED', 'SCHEDULE_RULE_STOPPED') limit 1;
  if found then
    if existing_audit.actor_admin_id is distinct from p_actor_admin_id or existing_audit.reason is distinct from fingerprint then
      raise exception 'schedule request was reused with different inputs' using errcode = '42501';
    end if;
    return coalesce(existing_audit.new_values, '{}'::jsonb) || jsonb_build_object('idempotent', true);
  end if;
  select * into rule_row from public.event_series_schedule_rules where id = p_rule_id for update;
  if not found then raise exception 'schedule rule was not found' using errcode = 'P0002'; end if;
  select * into series_row from public.event_series where id = rule_row.event_series_id for update;
  if p_effective_end_date < rule_row.effective_start_date or p_effective_end_date > series_row.ends_on then
    raise exception 'schedule end date is outside the series' using errcode = '22023';
  end if;
  if rule_row.effective_end_date is not null
     and rule_row.effective_end_date < series_row.ends_on
     and p_effective_end_date <> rule_row.effective_end_date then
    raise exception 'schedule rule is already stopped' using errcode = '40901';
  end if;
  perform set_config('app.recurrence_request_id', p_request_id::text, true);
  perform set_config('app.recurrence_defer_audit', 'on', true);
  perform set_config('app.recurrence_audit_context', jsonb_build_object('request_id', p_request_id,
    'actor_admin_id', p_actor_admin_id, 'series_id', rule_row.event_series_id,
    'effective_end_date', p_effective_end_date, 'logical_input_fingerprint', fingerprint)::text, true);
  update public.event_series_schedule_rules set effective_end_date = p_effective_end_date where id = p_rule_id;
  result := jsonb_build_object('rule_id', p_rule_id, 'series_id', rule_row.event_series_id,
    'effective_end_date', p_effective_end_date, 'occurrence_ids', '[]'::jsonb, 'occurrence_count', 0);
  insert into public.audit_events (
    actor_admin_id, action, entity_type, entity_id, old_values, new_values, request_id, reason
  ) values (
    p_actor_admin_id, 'SCHEDULE_RULE_STOPPED', 'EVENT_SERIES_SCHEDULE_RULE', p_rule_id,
    to_jsonb(rule_row), to_jsonb((select r from public.event_series_schedule_rules r where r.id = p_rule_id))
      || result || jsonb_build_object('logical_inputs', canonical), p_request_id::text, fingerprint
  );
  return result || jsonb_build_object('idempotent', false);
end;
$$;

revoke all on function public.phase3_materialize_schedule_rule(uuid, uuid) from public, anon, authenticated;
revoke all on function public.phase3_add_schedule_rule(uuid, uuid, smallint, time, time, date, uuid) from public, anon;
revoke all on function public.phase3_change_schedule_rule(uuid, uuid, smallint, time, time, date, uuid) from public, anon;
revoke all on function public.phase3_stop_schedule_rule(uuid, uuid, date, uuid) from public, anon;
grant execute on function public.phase3_add_schedule_rule(uuid, uuid, smallint, time, time, date, uuid) to authenticated;
grant execute on function public.phase3_change_schedule_rule(uuid, uuid, smallint, time, time, date, uuid) to authenticated;
grant execute on function public.phase3_stop_schedule_rule(uuid, uuid, date, uuid) to authenticated;
