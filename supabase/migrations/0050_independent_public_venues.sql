-- Slice A: Independent/Public Venue business support.
-- This migration is additive. Existing Organization Venue rows and Event
-- ownership remain unchanged; a Venue with organization_id = null is a
-- separately managed public location.

comment on column public.venues.organization_id is
  'Nullable owner. Non-null means Organization Venue; null means Independent/Public Venue.';

-- The existing Host Admin read policy already grants access to a Venue that
-- is referenced by an Event they can access. Keep that policy as the only
-- route for Host Admin visibility of an independent Venue; management remains
-- System Admin-only because the assigned-Organization write policies do not
-- authorize organization_id = null.

do $$
declare
  item record;
  definition text;
  updated_definition text;
begin
  -- Update the existing trigger/RPC/functions without rewriting historical
  -- migrations. The replacement is intentionally limited to the canonical
  -- Venue-to-Organization predicates.
  for item in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'enforce_event_phase_3_guards',
        'phase3_create_event_bundle',
        'phase7_registration_available',
        'get_public_event_by_slug',
        'get_public_event_by_slug_access',
        'register_selected_events_with_legal_legacy'
      )
  loop
    definition := pg_get_functiondef(item.oid);
    updated_definition := definition;
    updated_definition := replace(updated_definition,
      'v.organization_id = new.host_organization_id',
      '(v.organization_id = new.host_organization_id or v.organization_id is null)');
    updated_definition := replace(updated_definition,
      'organization_id = defaults_host_id',
      '(organization_id = defaults_host_id or organization_id is null)');
    updated_definition := replace(updated_definition,
      'v.organization_id = o.id',
      '(v.organization_id = o.id or v.organization_id is null)');
    updated_definition := replace(updated_definition,
      'v.organization_id=o.id',
      '(v.organization_id=o.id or v.organization_id is null)');
    updated_definition := replace(updated_definition,
      'v2.organization_id = o2.id',
      '(v2.organization_id = o2.id or v2.organization_id is null)');
    updated_definition := replace(updated_definition,
      'v2.organization_id=o2.id',
      '(v2.organization_id=o2.id or v2.organization_id is null)');
    if updated_definition <> definition then
      execute updated_definition;
    end if;
  end loop;
end $$;

-- Recreate the final public schedule projection with the current event-access
-- fields while allowing an active independent Venue to be displayed.
drop view if exists public.public_event_schedule;
create view public.public_event_schedule with (security_invoker = false) as
with upcoming as (
  select e.id, e.name, e.description, e.participant_instructions, e.event_title_color,
         e.starts_at, e.ends_at, e.timezone, e.capacity, e.registration_deadline, e.visibility,
         e.host_organization_id, coalesce(e.location_override_venue_id, e.venue_id) as venue_id,
         coalesce(s.public_slug, e.public_slug) as public_slug,
         o.name as host_organization_name, v.name as venue_name, v.street as venue_street,
         v.city as venue_city, v.state as venue_state, v.postal_code as venue_postal_code,
         (select count(*)::integer from public.registrations r where r.event_id = e.id
          and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE') as active_registration_count,
         row_number() over (partition by coalesce(e.event_series_id, e.id) order by e.starts_at) as occurrence_rank
    from public.events e
    join public.organizations o on o.id = e.host_organization_id and o.active_status = 'ACTIVE'
    join public.venues v on v.id = coalesce(e.location_override_venue_id, e.venue_id)
      and v.active_status = 'ACTIVE'
    left join public.event_series s on s.id = e.event_series_id
   where e.access_mode = 'PUBLIC' and e.status = 'OPEN' and e.publication_status = 'PUBLISHED'
     and e.archived_at is null and e.starts_at > now()
     and (e.registration_opens_at is null or e.registration_opens_at <= now())
     and (e.registration_closes_at is null or e.registration_closes_at > now())
     and e.registration_paused_at is null and e.registration_deadline >= now()
     and (e.event_series_id is null or s.public_slug is not null)
)
select id, name, description, participant_instructions, event_title_color, starts_at, ends_at,
       timezone, capacity, registration_deadline, visibility, host_organization_id, venue_id,
       public_slug, host_organization_name, venue_name, venue_street, venue_city, venue_state,
       venue_postal_code, active_registration_count
  from upcoming where occurrence_rank = 1;
grant select on public.public_event_schedule to anon, authenticated;
