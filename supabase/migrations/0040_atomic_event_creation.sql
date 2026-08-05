-- J5-16: create the event/series, image metadata, and audit record atomically.
create unique index if not exists audit_event_creation_request_uq
  on public.audit_events (request_id)
  where request_id is not null and action in ('EVENT_CREATED', 'EVENT_SERIES_CREATED');

drop function if exists public.phase3_create_event_bundle(text, uuid, uuid, date, jsonb, jsonb, jsonb, text, jsonb);
drop function if exists public.phase3_create_event_bundle(uuid, uuid, uuid, date, jsonb, jsonb, jsonb, text, jsonb);

create function public.phase3_create_event_bundle(
  p_request_id uuid,
  p_actor_admin_id uuid,
  p_series_id uuid,
  p_series_ends_on date,
  p_event_rows jsonb,
  p_defaults jsonb,
  p_assets jsonb,
  p_audit_action text,
  p_audit_values jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  existing_audit public.audit_events%rowtype;
  created_event_ids uuid[];
  audit_entity_id uuid;
  defaults_host_id uuid;
  defaults_venue_id uuid;
  defaults_timezone text;
  occurrence_count integer;
  distinct_occurrence_ids integer;
  null_occurrence_ids integer;
  null_time_values integer;
  null_occurrence_numbers integer;
  distinct_occurrence_numbers integer;
  min_occurrence_number integer;
  max_occurrence_number integer;
  first_occurrence_date date;
  assets_json jsonb := coalesce(p_assets, '[]'::jsonb);
  canonical_request jsonb;
  request_fingerprint text;
begin
  if auth.uid() is null or p_actor_admin_id is distinct from auth.uid()
     or not public.is_active_system_admin() then
    raise exception 'event creation requires an active System Admin' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'event creation request id is required' using errcode = '22023';
  end if;
  -- Serialize retries for the same request before any rows are written.
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  if p_audit_action not in ('EVENT_CREATED', 'EVENT_SERIES_CREATED') then
    raise exception 'invalid event creation audit action' using errcode = '22023';
  end if;
  if jsonb_typeof(p_event_rows) <> 'array' or jsonb_array_length(p_event_rows) not between 1 and 104 then
    raise exception 'event occurrences must be an array containing 1 to 104 rows' using errcode = '22023';
  end if;
  if jsonb_typeof(p_defaults) <> 'object' or jsonb_typeof(p_audit_values) <> 'object'
     or jsonb_typeof(assets_json) <> 'array' then
    raise exception 'event creation metadata has an invalid structure' using errcode = '22023';
  end if;
  if octet_length(p_audit_values::text) > 32768 then
    raise exception 'event audit metadata is too large' using errcode = '22023';
  end if;

  begin
    defaults_host_id := (p_defaults->>'host_organization_id')::uuid;
    defaults_venue_id := (p_defaults->>'venue_id')::uuid;
  exception when invalid_text_representation then
    raise exception 'event organization or venue is invalid' using errcode = '22023';
  end;
  defaults_timezone := nullif(btrim(p_defaults->>'timezone'), '');
  if defaults_host_id is null or defaults_venue_id is null or defaults_timezone is null
     or nullif(btrim(p_defaults->>'name'), '') is null
     or char_length(p_defaults->>'name') > 200
     or (p_defaults->>'capacity') !~ '^[0-9]+$'
     or (p_defaults->>'capacity')::integer <= 0
     or p_defaults->>'visibility' not in ('PUBLIC', 'AFFILIATION_RESTRICTED') then
    raise exception 'event defaults are invalid' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_timezone_names where name = defaults_timezone) then
    raise exception 'event timezone is not an approved IANA timezone' using errcode = '22023';
  end if;
  if char_length(coalesce(p_defaults->>'description', '')) > 5000
     or char_length(coalesce(p_defaults->>'participant_instructions', '')) > 5000 then
    raise exception 'event text fields are too long' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.organizations
    where id = defaults_host_id and active_status = 'ACTIVE'
  ) then
    raise exception 'event organization is not active' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.venues
    where id = defaults_venue_id and organization_id = defaults_host_id
      and active_status = 'ACTIVE' and timezone = defaults_timezone
  ) then
    raise exception 'event venue and timezone do not belong to the selected organization' using errcode = '42501';
  end if;

  select count(*), count(distinct id), count(*) filter (where id is null),
         count(*) filter (where starts_at is null or ends_at is null or registration_deadline is null),
         count(*) filter (where series_occurrence_number is null),
         count(distinct series_occurrence_number), min(series_occurrence_number), max(series_occurrence_number)
  into occurrence_count, distinct_occurrence_ids, null_occurrence_ids,
       null_time_values, null_occurrence_numbers, distinct_occurrence_numbers, min_occurrence_number, max_occurrence_number
  from jsonb_to_recordset(p_event_rows) as occurrence(
    id uuid, series_occurrence_number integer, starts_at timestamptz,
    ends_at timestamptz, registration_deadline timestamptz
  );
  if occurrence_count <> distinct_occurrence_ids or null_occurrence_ids > 0 or null_time_values > 0 then
    raise exception 'event occurrences contain duplicate or missing identifiers' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.events e
    where e.id in (select id from jsonb_to_recordset(p_event_rows) as occurrence(id uuid))
  ) then
    raise exception 'event occurrence identifiers are already in use' using errcode = '23505';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_event_rows) as occurrence(
      id uuid, series_occurrence_number integer, starts_at timestamptz,
      ends_at timestamptz, registration_deadline timestamptz
    )
    where ends_at <= starts_at or registration_deadline > starts_at
  ) then
    raise exception 'event occurrence times or deadline are invalid' using errcode = '22023';
  end if;

  if p_series_id is null then
    if p_series_ends_on is not null or occurrence_count <> 1
       or null_occurrence_numbers <> occurrence_count or distinct_occurrence_numbers <> 0 then
      raise exception 'single events cannot include recurrence metadata' using errcode = '22023';
    end if;
  else
    if p_series_ends_on is null or null_occurrence_numbers > 0
       or distinct_occurrence_numbers <> occurrence_count
       or min_occurrence_number <> 1 or max_occurrence_number <> occurrence_count then
      raise exception 'recurring occurrences must be a complete ordered sequence' using errcode = '22023';
    end if;
    select (starts_at at time zone defaults_timezone)::date into first_occurrence_date
    from jsonb_to_recordset(p_event_rows) as occurrence(
      id uuid, series_occurrence_number integer, starts_at timestamptz,
      ends_at timestamptz, registration_deadline timestamptz
    ) order by series_occurrence_number limit 1;
    if p_series_ends_on <> first_occurrence_date + (occurrence_count - 1) * 7 then
      raise exception 'recurring series end date does not match its occurrences' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_to_recordset(p_event_rows) as occurrence(
        id uuid, series_occurrence_number integer, starts_at timestamptz,
        ends_at timestamptz, registration_deadline timestamptz
      )
      where (starts_at at time zone defaults_timezone)::date
        <> first_occurrence_date + (series_occurrence_number - 1) * 7
    ) then
      raise exception 'recurring occurrences are not weekly in the venue timezone' using errcode = '22023';
    end if;
  end if;

  if exists (
    select 1 from jsonb_to_recordset(assets_json) as asset(
      event_id uuid, storage_path text, original_filename text,
      mime_type text, byte_size integer, content_sha256 text, alt_text text
    )
    where event_id is null
      or not exists (select 1 from jsonb_to_recordset(p_event_rows) as occurrence(id uuid) where occurrence.id = asset.event_id)
      or storage_path is null
      or storage_path not like 'event_image_staging/' || p_request_id::text || '/%'
      or mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/svg+xml')
      or byte_size not between 1 and 5242880
      or content_sha256 !~ '^[0-9a-f]{64}$'
      or char_length(coalesce(original_filename, '')) not between 1 and 255
      or char_length(coalesce(alt_text, '')) not between 1 and 240
  ) then
    raise exception 'event image metadata is invalid or references an unrelated event' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_to_recordset(assets_json) as asset(event_id uuid))
     <> (select count(distinct event_id) from jsonb_to_recordset(assets_json) as asset(event_id uuid)) then
    raise exception 'an event may have only one staged image in a creation request' using errcode = '22023';
  end if;
  if p_audit_values->>'name' is distinct from p_defaults->>'name'
     or p_audit_values->>'host_organization_id' is distinct from p_defaults->>'host_organization_id'
     or p_audit_values->>'venue_id' is distinct from p_defaults->>'venue_id'
     or p_audit_values->>'timezone' is distinct from p_defaults->>'timezone'
     or (p_audit_values->>'occurrence_count')::integer is distinct from occurrence_count then
    raise exception 'event audit metadata does not match the creation request' using errcode = '22023';
  end if;

  -- Bind the request id to every material input that can change the persisted result.
  -- jsonb gives deterministic object-key ordering; arrays are explicitly ordered below.
  canonical_request := jsonb_build_object(
    'actor_admin_id', p_actor_admin_id,
    'series_ends_on', p_series_ends_on,
    'audit_action', p_audit_action,
    'defaults', jsonb_build_object(
      'host_organization_id', defaults_host_id,
      'venue_id', defaults_venue_id,
      'name', p_defaults->>'name',
      'description', coalesce(p_defaults->>'description', ''),
      'participant_instructions', coalesce(p_defaults->>'participant_instructions', ''),
      'timezone', defaults_timezone,
      'capacity', (p_defaults->>'capacity')::integer,
      'visibility', p_defaults->>'visibility',
      'communication_url', coalesce(p_defaults->>'communication_url', ''),
      'communication_label', coalesce(p_defaults->>'communication_label', '')
    ),
    'occurrences', coalesce((
      select jsonb_agg(jsonb_build_object(
        'occurrence_key', coalesce(occurrence.series_occurrence_number, 1),
        'starts_at', occurrence.starts_at,
        'ends_at', occurrence.ends_at,
        'registration_deadline', occurrence.registration_deadline
      ) order by coalesce(occurrence.series_occurrence_number, 1), occurrence.starts_at, occurrence.ends_at)
      from jsonb_to_recordset(p_event_rows) as occurrence(
        id uuid, series_occurrence_number integer, starts_at timestamptz,
        ends_at timestamptz, registration_deadline timestamptz
      )
    ), '[]'::jsonb),
    'assets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'occurrence_key', coalesce(occurrence.series_occurrence_number, 1),
        'original_filename', asset.original_filename,
        'mime_type', asset.mime_type,
        'byte_size', asset.byte_size,
        'content_sha256', asset.content_sha256,
        'alt_text', asset.alt_text
      ) order by coalesce(occurrence.series_occurrence_number, 1), asset.mime_type,
        asset.byte_size, asset.content_sha256, asset.original_filename, asset.alt_text)
      from jsonb_to_recordset(assets_json) as asset(
        event_id uuid, storage_path text, original_filename text,
        mime_type text, byte_size integer, content_sha256 text, alt_text text
      )
      join jsonb_to_recordset(p_event_rows) as occurrence(
        id uuid, series_occurrence_number integer, starts_at timestamptz,
        ends_at timestamptz, registration_deadline timestamptz
      ) on occurrence.id = asset.event_id
    ), '[]'::jsonb),
    'audit_values', p_audit_values
  );
  request_fingerprint := encode(extensions.digest(canonical_request::text, 'sha256'), 'hex');

  select * into existing_audit
  from public.audit_events
  where request_id = p_request_id::text
    and action in ('EVENT_CREATED', 'EVENT_SERIES_CREATED')
  order by created_at limit 1;
  if found then
    if existing_audit.actor_admin_id is distinct from p_actor_admin_id
       or existing_audit.reason is distinct from request_fingerprint then
      raise exception 'event creation request belongs to another request or has inconsistent metadata' using errcode = '42501';
    end if;
    return coalesce(existing_audit.new_values, '{}'::jsonb) || jsonb_build_object('idempotent', true);
  end if;

  if p_series_id is not null then
    insert into public.event_series (
      id, frequency, interval_count, ends_on, selection_window_days, created_by_admin_id
    ) values (p_series_id, 'WEEKLY', 1, p_series_ends_on, 14, p_actor_admin_id);
  end if;

  with inserted_events as (
    insert into public.events (
      id, event_series_id, series_occurrence_number, host_organization_id, venue_id,
      name, description, participant_instructions, starts_at, ends_at, timezone,
      registration_deadline, capacity, visibility, communication_url, communication_label,
      created_by_admin_id
    )
    select occurrence.id, p_series_id, occurrence.series_occurrence_number,
      defaults_host_id, defaults_venue_id, p_defaults->>'name',
      nullif(p_defaults->>'description', ''), nullif(p_defaults->>'participant_instructions', ''),
      occurrence.starts_at, occurrence.ends_at, defaults_timezone, occurrence.registration_deadline,
      (p_defaults->>'capacity')::integer, (p_defaults->>'visibility')::event_visibility,
      nullif(p_defaults->>'communication_url', ''), nullif(p_defaults->>'communication_label', ''),
      p_actor_admin_id
    from jsonb_to_recordset(p_event_rows) as occurrence(
      id uuid, series_occurrence_number integer, starts_at timestamptz,
      ends_at timestamptz, registration_deadline timestamptz
    )
    returning id
  )
  select array_agg(id order by id) into created_event_ids from inserted_events;

  insert into public.design_assets (
    event_id, asset_type, storage_path, original_filename, mime_type, byte_size,
    alt_text, focal_position, created_by_admin_id
  )
  select asset.event_id, 'EVENT_IMAGE_DESKTOP', asset.storage_path, asset.original_filename,
    asset.mime_type, asset.byte_size, asset.alt_text, 'center', p_actor_admin_id
  from jsonb_to_recordset(assets_json) as asset(
    event_id uuid, storage_path text, original_filename text,
    mime_type text, byte_size integer, content_sha256 text, alt_text text
  );

  audit_entity_id := coalesce(p_series_id, created_event_ids[1]);
  begin
    insert into public.audit_events (
      actor_admin_id, action, entity_type, entity_id, new_values, request_id, reason
    ) values (
      p_actor_admin_id, p_audit_action,
      case when p_series_id is null then 'EVENT' else 'EVENT_SERIES' end,
      audit_entity_id,
      coalesce(p_audit_values, '{}'::jsonb)
        || jsonb_build_object('event_ids', to_jsonb(created_event_ids), 'series_id', p_series_id),
      p_request_id::text,
      request_fingerprint
    );
  exception when unique_violation then
    select * into existing_audit from public.audit_events
    where request_id = p_request_id::text
      and action in ('EVENT_CREATED', 'EVENT_SERIES_CREATED')
    order by created_at limit 1;
    if existing_audit.actor_admin_id is distinct from p_actor_admin_id
       or existing_audit.reason is distinct from request_fingerprint then
      raise exception 'event creation request belongs to another System Admin' using errcode = '42501';
    end if;
    return coalesce(existing_audit.new_values, '{}'::jsonb) || jsonb_build_object('idempotent', true);
  end;

  insert into public.audit_events (
    actor_admin_id, action, entity_type, entity_id, new_values, request_id
  )
  select p_actor_admin_id, 'DESIGN_ASSET_UPLOADED', 'DESIGN_ASSET', asset.id,
    jsonb_build_object('asset_type', asset.asset_type, 'event_id', asset.event_id,
      'mime_type', asset.mime_type, 'byte_size', asset.byte_size), p_request_id::text
  from public.design_assets asset
  where asset.created_by_admin_id = p_actor_admin_id
    and asset.event_id = any(created_event_ids)
    and asset.storage_path in (
      select value->>'storage_path' from jsonb_array_elements(assets_json)
    );

  return coalesce(p_audit_values, '{}'::jsonb)
    || jsonb_build_object('event_ids', to_jsonb(created_event_ids), 'series_id', p_series_id, 'idempotent', false);
end;
$$;

revoke all on function public.phase3_create_event_bundle(uuid, uuid, uuid, date, jsonb, jsonb, jsonb, text, jsonb)
  from public, anon;
grant execute on function public.phase3_create_event_bundle(uuid, uuid, uuid, date, jsonb, jsonb, jsonb, text, jsonb)
  to authenticated;
