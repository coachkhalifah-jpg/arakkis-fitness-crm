-- Slice C: one atomic Create Event bundle for multiple schedule rules.
-- The existing phase3_create_event_bundle remains the non-recurring path.

create or replace function public.phase3_create_multi_schedule_bundle(
  p_request_id uuid,
  p_actor_admin_id uuid,
  p_series_id uuid,
  p_series_ends_on date,
  p_schedule_rules jsonb,
  p_defaults jsonb,
  p_assets jsonb,
  p_audit_action text,
  p_audit_values jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  existing_audit public.audit_events%rowtype;
  host_id uuid;
  venue_id uuid;
  actor uuid;
  timezone_name text;
  series_end date;
  template_start timestamp without time zone;
  template_end timestamp without time zone;
  template_deadline timestamp without time zone;
  deadline_offset interval;
  opens_offset interval;
  closes_offset interval;
  rule_row record;
  occurrence_date date;
  local_start timestamp without time zone;
  local_end timestamp without time zone;
  starts_at timestamptz;
  ends_at timestamptz;
  deadline_at timestamptz;
  opens_at timestamptz;
  closes_at timestamptz;
  canonical_request jsonb;
  request_fingerprint text;
  series_rule_ids uuid[];
  event_ids uuid[];
  occurrence_count integer;
  rule_count integer;
  next_number integer;
  first_generated timestamptz;
  series_rule_id uuid;
  inserted_asset_count integer;
begin
  if auth.uid() is null or p_actor_admin_id is distinct from auth.uid()
     or not public.is_active_system_admin() then
    raise exception 'event creation requires an active System Admin' using errcode = '42501';
  end if;
  if p_request_id is null then raise exception 'event creation request id is required' using errcode = '22023'; end if;
  if p_series_id is null or p_series_ends_on is null then raise exception 'recurring series metadata is required' using errcode = '22023'; end if;
  if p_audit_action <> 'EVENT_SERIES_CREATED' then raise exception 'invalid recurring creation audit action' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));

  canonical_request := jsonb_build_object(
    'actor_admin_id', p_actor_admin_id,
    'series_id', p_series_id,
    'series_ends_on', p_series_ends_on,
    'schedule_rules', coalesce(p_schedule_rules, '[]'::jsonb),
    'defaults', coalesce(p_defaults, '{}'::jsonb),
    'assets', coalesce(p_assets, '[]'::jsonb),
    'audit_action', p_audit_action,
    'audit_values', coalesce(p_audit_values, '{}'::jsonb)
  );
  request_fingerprint := encode(extensions.digest(canonical_request::text, 'sha256'), 'hex');

  select * into existing_audit from public.audit_events
  where request_id = p_request_id::text and action = 'EVENT_SERIES_CREATED'
  order by created_at limit 1;
  if found then
    if existing_audit.actor_admin_id is distinct from p_actor_admin_id
       or existing_audit.reason is distinct from request_fingerprint then
      raise exception 'event creation request was reused with different inputs' using errcode = '42501';
    end if;
    return coalesce(existing_audit.new_values, '{}'::jsonb) || jsonb_build_object('idempotent', true);
  end if;

  if jsonb_typeof(p_schedule_rules) <> 'array' or jsonb_array_length(p_schedule_rules) not between 1 and 14 then
    raise exception 'add one to fourteen schedule rows' using errcode = '22023';
  end if;
  if jsonb_typeof(p_defaults) <> 'object' or jsonb_typeof(coalesce(p_assets, '[]'::jsonb)) <> 'array' then
    raise exception 'recurring Event metadata has an invalid structure' using errcode = '22023';
  end if;

  begin
    host_id := (p_defaults->>'host_organization_id')::uuid;
    venue_id := (p_defaults->>'venue_id')::uuid;
    template_start := (p_defaults->>'start_local')::timestamp;
    template_end := (p_defaults->>'end_local')::timestamp;
    template_deadline := (p_defaults->>'registration_deadline_local')::timestamp;
  exception when invalid_text_representation then
    raise exception 'Organization, Venue, or local schedule value is invalid' using errcode = '22023';
  end;
  timezone_name := nullif(btrim(p_defaults->>'timezone'), '');
  series_end := p_series_ends_on;
  if host_id is null or venue_id is null or timezone_name is null
     or nullif(btrim(p_defaults->>'name'), '') is null
     or (p_defaults->>'capacity') !~ '^[0-9]+$'
     or (p_defaults->>'capacity')::integer <= 0
     or p_defaults->>'visibility' not in ('PUBLIC', 'AFFILIATION_RESTRICTED')
     or p_defaults->>'access_mode' not in ('PUBLIC', 'UNLISTED', 'INVITE_ONLY') then
    raise exception 'recurring Event defaults are invalid' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_timezone_names where name = timezone_name) then
    raise exception 'Event timezone is not an approved IANA timezone' using errcode = '22023';
  end if;
  if template_end <= template_start or template_deadline > template_start then
    raise exception 'Event local times or registration deadline are invalid' using errcode = '22023';
  end if;
  if template_start::date > series_end then raise exception 'series end date is before the first Event' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.organizations o join public.venues v on v.id = venue_id
    where o.id = host_id and o.active_status = 'ACTIVE' and v.active_status = 'ACTIVE'
      and (v.organization_id is null or v.organization_id = host_id) and v.timezone = timezone_name
  ) then
    raise exception 'Event Organization, Venue, or Venue timezone is invalid' using errcode = '42501';
  end if;
  if char_length(coalesce(p_defaults->>'description','')) > 5000
     or char_length(coalesce(p_defaults->>'participant_instructions','')) > 5000 then
    raise exception 'Event text fields are too long' using errcode = '22023';
  end if;

  deadline_offset := template_deadline - template_start;
  opens_offset := case when nullif(p_defaults->>'registration_opens_local','') is null then null
    else (p_defaults->>'registration_opens_local')::timestamp - template_start end;
  closes_offset := case when nullif(p_defaults->>'registration_closes_local','') is null then null
    else (p_defaults->>'registration_closes_local')::timestamp - template_start end;

  drop table if exists phase3_create_schedule_rules;
  drop table if exists phase3_create_occurrences;
  create temp table phase3_create_schedule_rules (
    rule_index integer primary key,
    id uuid not null,
    weekday smallint not null,
    local_start_time time not null,
    local_end_time time not null,
    effective_start_date date not null
  ) on commit drop;
  create temp table phase3_create_occurrences (
    ordinal integer,
    rule_index integer not null,
    local_date date not null unique,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    registration_deadline timestamptz not null,
    registration_opens_at timestamptz,
    registration_closes_at timestamptz,
    id uuid not null default gen_random_uuid(),
    occurrence_number integer not null
  ) on commit drop;

  insert into phase3_create_schedule_rules (rule_index,id,weekday,local_start_time,local_end_time,effective_start_date)
  select row_number() over (), gen_random_uuid(), weekday, local_start_time, local_end_time,
    coalesce(effective_start_date, template_start::date)
  from jsonb_to_recordset(p_schedule_rules) as r(
    weekday smallint, local_start_time time, local_end_time time, effective_start_date date
  );
  select count(*) into rule_count from phase3_create_schedule_rules;
  if exists (select 1 from phase3_create_schedule_rules where weekday not between 1 and 7 or local_end_time <= local_start_time) then
    raise exception 'A schedule row has an invalid weekday or time order' using errcode = '22023';
  end if;
  if exists (
    select 1 from phase3_create_schedule_rules a
    join phase3_create_schedule_rules b on a.rule_index < b.rule_index
    where a.weekday = b.weekday
      and a.local_start_time < b.local_end_time
      and b.local_start_time < a.local_end_time
  ) then
    raise exception 'Schedule rows contain duplicate or overlapping weekday/time definitions' using errcode = '23505';
  end if;
  if exists (select 1 from phase3_create_schedule_rules where effective_start_date > series_end) then
    raise exception 'A schedule effective date is after the series end date' using errcode = '22023';
  end if;

  for rule_row in select * from phase3_create_schedule_rules order by rule_index loop
    for occurrence_date in
      select d::date from generate_series(rule_row.effective_start_date::timestamp, series_end::timestamp, interval '1 day') as dates(d)
      where extract(isodow from d) = rule_row.weekday order by d
    loop
      local_start := occurrence_date + rule_row.local_start_time;
      local_end := occurrence_date + rule_row.local_end_time;
      if ((local_start at time zone timezone_name) at time zone timezone_name) <> local_start
         or ((local_end at time zone timezone_name) at time zone timezone_name) <> local_end then
        raise exception 'Schedule row % contains a local time that does not exist in the Venue timezone', rule_row.rule_index using errcode = '22023';
      end if;
      starts_at := local_start at time zone timezone_name;
      ends_at := local_end at time zone timezone_name;
      deadline_at := starts_at + deadline_offset;
      opens_at := case when opens_offset is null then null else starts_at + opens_offset end;
      closes_at := case when closes_offset is null then null else starts_at + closes_offset end;
      if deadline_at > starts_at or (opens_at is not null and opens_at >= starts_at)
         or (opens_at is not null and closes_at is not null and closes_at <= opens_at) then
        raise exception 'The registration window is invalid for schedule row %', rule_row.rule_index using errcode = '22023';
      end if;
      insert into phase3_create_occurrences (rule_index,local_date,starts_at,ends_at,registration_deadline,registration_opens_at,registration_closes_at,occurrence_number)
      values (rule_row.rule_index,occurrence_date,starts_at,ends_at,deadline_at,opens_at,closes_at,0);
    end loop;
  end loop;
  if not exists (select 1 from phase3_create_occurrences) then raise exception 'Schedules have no valid dates before the series end' using errcode = '22023'; end if;
  select count(*) into occurrence_count from phase3_create_occurrences;
  if occurrence_count > 104 then raise exception 'A recurring Event may contain at most 104 total dates' using errcode = '22023'; end if;
  update phase3_create_occurrences o set ordinal = ranked.ordinal, occurrence_number = ranked.ordinal
  from (select source.local_date, row_number() over (order by source.starts_at, source.local_date)::integer ordinal from phase3_create_occurrences source) ranked
  where o.local_date = ranked.local_date;
  select source.starts_at into first_generated from phase3_create_occurrences source where source.ordinal = 1;
  if (first_generated at time zone timezone_name) <> template_start then
    raise exception 'The first schedule row must match the Event date and start time' using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p_assets, '[]'::jsonb)) not in (0, occurrence_count) then
    raise exception 'Event image metadata does not match generated occurrences' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(coalesce(p_assets, '[]'::jsonb)) as a(
      occurrence_index integer, storage_path text, original_filename text, mime_type text, byte_size integer, content_sha256 text, alt_text text
    ) where occurrence_index is null or occurrence_index < 1 or occurrence_index > occurrence_count
      or storage_path is null or storage_path not like 'event_image_staging/' || p_request_id::text || '/%'
      or mime_type not in ('image/jpeg','image/png','image/webp','image/svg+xml')
      or byte_size not between 1 and 5242880 or content_sha256 !~ '^[0-9a-f]{64}$'
      or char_length(coalesce(original_filename,'')) not between 1 and 255
      or char_length(coalesce(alt_text,'')) not between 1 and 240
  ) then raise exception 'Event image metadata is invalid' using errcode = '22023'; end if;

  perform set_config('app.recurrence_request_id', p_request_id::text, true);
  perform set_config('app.recurrence_audit_context', jsonb_build_object(
    'request_id', p_request_id, 'actor_admin_id', p_actor_admin_id, 'series_id', p_series_id,
    'effective_start_date', template_start::date, 'effective_end_date', series_end
  )::text, true);
  insert into public.event_series (id,frequency,interval_count,ends_on,selection_window_days,created_by_admin_id)
  values (p_series_id,'WEEKLY',1,series_end,14,p_actor_admin_id);
  insert into public.event_series_schedule_rules (id,event_series_id,weekday,local_start_time,local_end_time,effective_start_date,effective_end_date,created_by_admin_id)
  select id,p_series_id,weekday,local_start_time,local_end_time,effective_start_date,series_end,p_actor_admin_id
  from phase3_create_schedule_rules order by rule_index;
  select array_agg(id order by rule_index) into series_rule_ids from phase3_create_schedule_rules;
  insert into public.events (
    id,event_series_id,series_occurrence_number,host_organization_id,venue_id,name,description,participant_instructions,event_title_color,
    starts_at,ends_at,timezone,registration_deadline,registration_opens_at,registration_closes_at,capacity,visibility,access_mode,
    communication_url,communication_label,status,publication_status,created_by_admin_id,schedule_rule_id,generated_local_date
  ) select o.id,p_series_id,o.occurrence_number,host_id,venue_id,p_defaults->>'name',nullif(p_defaults->>'description',''),nullif(p_defaults->>'participant_instructions',''),coalesce(p_defaults->>'event_title_color','#FFFFFF'),
    o.starts_at,o.ends_at,timezone_name,o.registration_deadline,o.registration_opens_at,o.registration_closes_at,(p_defaults->>'capacity')::integer,(p_defaults->>'visibility')::event_visibility,p_defaults->>'access_mode',
    nullif(p_defaults->>'communication_url',''),nullif(p_defaults->>'communication_label',''),'DRAFT','DRAFT',p_actor_admin_id,r.id,o.local_date
  from phase3_create_occurrences o join phase3_create_schedule_rules r using (rule_index) order by o.ordinal;
  select array_agg(id order by series_occurrence_number) into event_ids from public.events where event_series_id = p_series_id;
  insert into public.design_assets (event_id,asset_type,storage_path,original_filename,mime_type,byte_size,alt_text,created_by_admin_id)
  select o.id,'EVENT_IMAGE_DESKTOP',a.storage_path,a.original_filename,a.mime_type,a.byte_size,a.alt_text,p_actor_admin_id
  from jsonb_to_recordset(coalesce(p_assets, '[]'::jsonb)) as a(occurrence_index integer,storage_path text,original_filename text,mime_type text,byte_size integer,content_sha256 text,alt_text text)
  join phase3_create_occurrences o on o.ordinal = a.occurrence_index;
  get diagnostics inserted_asset_count = row_count;
  insert into public.audit_events (actor_admin_id,action,entity_type,entity_id,new_values,request_id,reason)
  values (p_actor_admin_id,p_audit_action,'EVENT_SERIES',p_series_id,
    coalesce(p_audit_values,'{}'::jsonb) || jsonb_build_object('event_ids',to_jsonb(event_ids),'series_id',p_series_id,'schedule_rule_ids',to_jsonb(series_rule_ids),'occurrence_count',occurrence_count),
    p_request_id::text,request_fingerprint);
  return coalesce(p_audit_values,'{}'::jsonb) || jsonb_build_object('event_ids',to_jsonb(event_ids),'series_id',p_series_id,'schedule_rule_ids',to_jsonb(series_rule_ids),'occurrence_count',occurrence_count,'idempotent',false);
end;
$$;

revoke all on function public.phase3_create_multi_schedule_bundle(uuid,uuid,uuid,date,jsonb,jsonb,jsonb,text,jsonb) from public, anon;
grant execute on function public.phase3_create_multi_schedule_bundle(uuid,uuid,uuid,date,jsonb,jsonb,jsonb,text,jsonb) to authenticated;
