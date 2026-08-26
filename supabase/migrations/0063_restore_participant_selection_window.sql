-- Restore the bounded participant occurrence-selection window.
-- Administrative recurrence views may expose the full generated series, but
-- participant registration must remain limited by the series window (14 days
-- by default, and never more than the schema-approved maximum).

create or replace function public.phase10_participant_selection_window_allows(
  p_event_ids uuid[]
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(cardinality(p_event_ids), 0) > 0
    and not exists (
      select 1
      from public.events e
      left join public.event_series s on s.id = e.event_series_id
      where e.id = any(p_event_ids)
        and e.event_series_id is not null
        and e.starts_at > now() + make_interval(days => coalesce(s.selection_window_days, 14))
    );
$$;

revoke all on function public.phase10_participant_selection_window_allows(uuid[]) from public, anon, authenticated;

create or replace function public.get_public_event_by_slug_access(
  p_slug text,
  p_invite_token text default null
)
returns jsonb language sql security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'id', e.id, 'name', e.name, 'description', e.description,
    'participant_instructions', e.participant_instructions,
    'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
    'host_organization_name', o.name, 'venue_name', v.name, 'venue_street', v.street,
    'venue_city', v.city, 'venue_state', v.state, 'venue_postal_code', v.postal_code,
    'visibility', e.visibility, 'access_mode', e.access_mode,
    'availability', case
      when not public.phase7_registration_legal_allowed() then 'LEGALLY_BLOCKED'
      when public.phase7_registration_available(e.id) then 'OPEN'
      when e.status = 'CANCELLED' then 'CANCELLED'
      when e.publication_status <> 'PUBLISHED' then 'UNPUBLISHED'
      when e.registration_paused_at is not null then 'PAUSED'
      when e.registration_opens_at is not null and e.registration_opens_at > now() then 'NOT_YET_OPEN'
      when e.registration_closes_at is not null and e.registration_closes_at <= now() then 'CLOSED'
      when e.registration_deadline < now() then 'CLOSED'
      else 'FULL'
    end,
    'capacity', e.capacity,
    'active_registration_count', (select count(*)::integer from public.registrations r
      where r.event_id = e.id and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE'),
    'series_slug', s.public_slug,
    'occurrences', case when s.id is null then jsonb_build_array(jsonb_build_object(
      'id', e.id, 'name', e.name, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
      'timezone', e.timezone, 'capacity', e.capacity,
      'active_registration_count', (select count(*)::integer from public.registrations r2
        where r2.event_id = e.id and r2.registration_status = 'REGISTERED' and r2.registration_outcome = 'ACTIVE'),
      'availability', case
        when not public.phase7_registration_legal_allowed() then 'LEGALLY_BLOCKED'
        when public.phase7_registration_available(e.id) then 'OPEN'
        when e.status = 'CANCELLED' then 'CANCELLED'
        when e.publication_status <> 'PUBLISHED' then 'UNPUBLISHED'
        when e.registration_paused_at is not null then 'PAUSED'
        when e.registration_opens_at is not null and e.registration_opens_at > now() then 'NOT_YET_OPEN'
        when e.registration_closes_at is not null and e.registration_closes_at <= now() then 'CLOSED'
        when e.registration_deadline < now() then 'CLOSED'
        else 'FULL'
      end,
      'venue_name', v.name, 'venue_street', v.street, 'venue_city', v.city,
      'venue_state', v.state, 'venue_postal_code', v.postal_code,
      'host_organization_name', o.name
    )) else coalesce((select jsonb_agg(jsonb_build_object(
      'id', e2.id, 'name', e2.name, 'starts_at', e2.starts_at, 'ends_at', e2.ends_at,
      'timezone', e2.timezone, 'capacity', e2.capacity,
      'active_registration_count', (select count(*)::integer from public.registrations r3
        where r3.event_id = e2.id and r3.registration_status = 'REGISTERED' and r3.registration_outcome = 'ACTIVE'),
      'availability', case
        when not public.phase7_registration_legal_allowed() then 'LEGALLY_BLOCKED'
        when public.phase7_registration_available(e2.id) then 'OPEN'
        when e2.status = 'CANCELLED' then 'CANCELLED'
        when e2.publication_status <> 'PUBLISHED' then 'UNPUBLISHED'
        when e2.registration_paused_at is not null then 'PAUSED'
        when e2.registration_opens_at is not null and e2.registration_opens_at > now() then 'NOT_YET_OPEN'
        when e2.registration_closes_at is not null and e2.registration_closes_at <= now() then 'CLOSED'
        when e2.registration_deadline < now() then 'CLOSED'
        else 'FULL'
      end,
      'venue_name', v2.name, 'venue_street', v2.street, 'venue_city', v2.city,
      'venue_state', v2.state, 'venue_postal_code', v2.postal_code,
      'host_organization_name', o2.name
    ) order by e2.starts_at) from public.events e2
      join public.organizations o2 on o2.id = e2.host_organization_id and o2.active_status = 'ACTIVE'
      join public.venues v2 on v2.id = coalesce(e2.location_override_venue_id, e2.venue_id)
        and v2.active_status = 'ACTIVE'
      where e2.event_series_id = s.id and e2.archived_at is null
        and e2.starts_at > now()
        and e2.starts_at <= now() + make_interval(days => coalesce(s.selection_window_days, 14))
        and public.phase10_event_access_allows(array[e2.id], p_invite_token)), '[]'::jsonb) end
  )
    from public.events e
    join public.organizations o on o.id = e.host_organization_id and o.active_status = 'ACTIVE'
    join public.venues v on v.id = coalesce(e.location_override_venue_id, e.venue_id)
      and v.active_status = 'ACTIVE'
    left join public.event_series s on s.id = e.event_series_id
   where p_slug is not null and p_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     and ((e.public_slug = lower(btrim(p_slug))) or (s.public_slug = lower(btrim(p_slug))))
     and e.archived_at is null and e.starts_at > now()
     and e.status = 'OPEN' and e.publication_status = 'PUBLISHED'
     and public.phase10_event_access_allows(array[e.id], p_invite_token)
   order by e.starts_at limit 1;
$$;

revoke all on function public.get_public_event_by_slug_access(text, text) from public;
grant execute on function public.get_public_event_by_slug_access(text, text) to anon, authenticated;

create or replace function public.register_selected_events_with_access(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_event_ids uuid[];
  v_result jsonb;
begin
  select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_event_ids
    from jsonb_array_elements_text(coalesce(p_payload->'event_ids', '[]'::jsonb));
  if not public.phase10_event_access_allows(v_event_ids, nullif(p_payload->>'event_access_token', ''))
     or not public.phase10_participant_selection_window_allows(v_event_ids) then
    raise exception 'event registration is unavailable' using errcode = '42501';
  end if;
  v_result := public.register_selected_events_with_legal(
    p_payload->>'first_name', p_payload->>'last_name', p_payload->>'display_phone',
    p_payload->>'normalized_phone', p_payload->>'phone_country', p_payload->>'email',
    p_payload->>'normalized_email', p_payload->>'fitness_experience', p_payload->>'goals', v_event_ids,
    nullif(p_payload->>'participation_acknowledgment_version_id','')::uuid,
    nullif(p_payload->>'data_use_acknowledgment_version_id','')::uuid,
    nullif(p_payload->>'participation_acknowledged_at','')::timestamptz,
    nullif(p_payload->>'data_use_acknowledged_at','')::timestamptz,
    nullif(p_payload->>'ip_address','')::inet, p_payload->>'user_agent', p_payload->>'idempotency_key',
    p_payload->>'referral_source', p_payload->>'referral_source_other_text',
    coalesce((select array_agg(value::uuid) from jsonb_array_elements_text(coalesce(p_payload->'legal_document_version_ids','[]'::jsonb))), '{}'::uuid[]),
    nullif(p_payload->>'legal_package_id','')::uuid
  );
  return v_result;
end;
$$;

revoke all on function public.register_selected_events_with_access(jsonb) from public;
grant execute on function public.register_selected_events_with_access(jsonb) to anon, authenticated;

-- Keep the goals-aware registration overload callable by browser roles after
-- the final migration replay. This is the authoritative public transaction.
grant execute on function public.register_selected_events_with_legal(
  text,text,text,text,text,text,text,text,text,uuid[],uuid,uuid,
  timestamptz,timestamptz,inet,text,text,text,text,uuid[],uuid
) to anon, authenticated;
