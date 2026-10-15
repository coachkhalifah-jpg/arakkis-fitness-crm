-- DEC-068: Public Events hub shows the next upcoming occurrence per series
-- weekday (venue-local ISO dow), not only the single soonest series date.
-- One-time Events are unchanged (partition key includes event id).
-- Registration still uses the rolling 14-day selection window on the series link.

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
         row_number() over (
           partition by
             coalesce(e.event_series_id, e.id),
             extract(isodow from (e.starts_at at time zone e.timezone))
           order by e.starts_at
         ) as occurrence_rank
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

comment on view public.public_event_schedule is
  'Anonymous hub projection: next bookable occurrence per Event or per series weekday (DEC-068); registration/confirmation remain RPC-only.';

grant select on public.public_event_schedule to anon, authenticated;
