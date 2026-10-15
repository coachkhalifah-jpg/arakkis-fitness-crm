-- DEC-065 / UAT-019: materialize always copies from the canonical earliest
-- occurrence. Sibling per-occurrence overrides (capacity, copy, communication,
-- cancelled edits, etc.) must not block Add day / Change / Extend. Homogeneity
-- check removed; org/venue validity on the template remains.

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

  -- Canonical template: earliest occurrence. New dates copy these fields;
  -- existing siblings may diverge (per-occurrence independence / DEC-049).
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

revoke all on function public.phase3_materialize_schedule_rule(uuid, uuid) from public, anon, authenticated;
