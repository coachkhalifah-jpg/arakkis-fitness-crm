-- Expose only participant-safe Event fields needed by the existing booking detail view.
create or replace function public.get_participant_upcoming_bookings(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_participant_id uuid; v_result jsonb;
begin
  v_participant_id := public.phase10_resolve_booking_participant(p_token);
  if v_participant_id is null then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'registration_id', r.id, 'event_id', e.id, 'name', e.name,
    'description', e.description, 'participant_instructions', e.participant_instructions,
    'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
    'venue_name', v.name, 'venue_street', v.street, 'venue_city', v.city,
    'venue_state', v.state, 'venue_postal_code', v.postal_code,
    'host_organization_name', o.name, 'location_updated', e.location_override_venue_id is not null,
    'registration_status', r.registration_status, 'registration_outcome', r.registration_outcome,
    'series_slug', s.public_slug,
    'communication_url', e.communication_url, 'communication_label', e.communication_label
  ) order by e.starts_at), '[]'::jsonb) into v_result
  from public.registrations r
  join public.events e on e.id = r.event_id
  join public.organizations o on o.id = e.host_organization_id and o.active_status = 'ACTIVE'
  join public.venues v on v.id = coalesce(e.location_override_venue_id, e.venue_id) and v.active_status = 'ACTIVE'
  left join public.event_series s on s.id = e.event_series_id
  where r.participant_id = v_participant_id and r.registration_status in ('REGISTERED', 'CANCELLED')
    and r.registration_outcome in ('ACTIVE', 'PARTICIPANT_CANCELLED')
    and e.starts_at > now() and e.status <> 'CANCELLED';
  return jsonb_build_object('participant_id', v_participant_id, 'bookings', v_result);
end;
$$;

revoke all on function public.get_participant_upcoming_bookings(text) from public;
grant execute on function public.get_participant_upcoming_bookings(text) to service_role;
