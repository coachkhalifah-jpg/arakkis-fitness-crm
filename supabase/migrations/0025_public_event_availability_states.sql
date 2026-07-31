-- Pilot validation: expose every public registration availability state.
-- Additive function correction; prior migrations remain unchanged.
create or replace function public.get_public_event_by_slug(p_slug text)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'name', e.name, 'description', e.description, 'participant_instructions', e.participant_instructions,
    'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone, 'capacity', e.capacity,
    'active_registration_count', (select count(*)::integer from public.registrations r where r.event_id = e.id and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE'),
    'registration_deadline', e.registration_deadline, 'visibility', e.visibility,
    'host_organization_name', o.name, 'venue_name', v.name, 'venue_street', v.street,
    'venue_city', v.city, 'venue_state', v.state, 'series_slug', s.public_slug,
    'occurrences', case when s.id is null then jsonb_build_array(jsonb_build_object(
      'name', e.name, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
      'capacity', e.capacity, 'active_registration_count', (select count(*)::integer from public.registrations r2 where r2.event_id = e.id and r2.registration_status = 'REGISTERED' and r2.registration_outcome = 'ACTIVE')
    )) else coalesce((select jsonb_agg(jsonb_build_object(
      'name', e2.name, 'starts_at', e2.starts_at, 'ends_at', e2.ends_at, 'timezone', e2.timezone,
      'capacity', e2.capacity, 'active_registration_count', (select count(*)::integer from public.registrations r3 where r3.event_id = e2.id and r3.registration_status = 'REGISTERED' and r3.registration_outcome = 'ACTIVE')
    ) order by e2.starts_at) from public.events e2 where e2.event_series_id = s.id and e2.archived_at is null and e2.status = 'OPEN' and e2.starts_at > now() and e2.starts_at <= now() + interval '14 days'), '[]'::jsonb) end,
    'availability', case when not public.phase7_registration_legal_allowed() then 'LEGALLY_BLOCKED'
      when public.phase7_registration_available(e.id) then 'OPEN' when e.status = 'CANCELLED' then 'CANCELLED'
      when e.publication_status <> 'PUBLISHED' then 'UNPUBLISHED'
      when e.registration_paused_at is not null then 'PAUSED'
      when e.registration_opens_at is not null and e.registration_opens_at > now() then 'NOT_YET_OPEN'
      when e.registration_closes_at is not null and e.registration_closes_at <= now() then 'CLOSED'
      when e.registration_deadline < now() then 'CLOSED' else 'FULL' end
  )
  from public.events e
  join public.organizations o on o.id = e.host_organization_id and o.active_status = 'ACTIVE'
  join public.venues v on v.id = e.venue_id and v.organization_id = o.id and v.active_status = 'ACTIVE'
  left join public.event_series s on s.id = e.event_series_id
  where p_slug is not null and p_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and e.archived_at is null
    and ((e.public_slug = lower(btrim(p_slug))) or (s.public_slug = lower(btrim(p_slug)))) and e.starts_at > now()
  order by e.starts_at limit 1;
$$;
revoke all on function public.get_public_event_by_slug(text) from public;
grant execute on function public.get_public_event_by_slug(text) to anon, authenticated;
