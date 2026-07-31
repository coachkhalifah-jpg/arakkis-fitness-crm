-- Phase 8: weekly recurring event series with a bounded public selection window.
create type public.event_recurrence_frequency as enum ('WEEKLY');

create table public.event_series (
  id uuid primary key default gen_random_uuid(),
  frequency public.event_recurrence_frequency not null default 'WEEKLY',
  interval_count integer not null default 1,
  ends_on date not null,
  selection_window_days integer not null default 14,
  public_slug text,
  created_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_series_interval_check check (interval_count = 1),
  constraint event_series_window_check check (selection_window_days between 1 and 14),
  constraint event_series_slug_check check (public_slug is null or (char_length(public_slug) between 1 and 80 and public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'))
);

alter table public.events
  add column if not exists event_series_id uuid references public.event_series(id) on delete restrict,
  add column if not exists series_occurrence_number integer;

alter table public.events
  add constraint events_series_occurrence_check
  check ((event_series_id is null and series_occurrence_number is null) or (event_series_id is not null and series_occurrence_number > 0));

create unique index event_series_public_slug_uq on public.event_series(public_slug) where public_slug is not null;
create unique index events_series_occurrence_uq on public.events(event_series_id, series_occurrence_number) where event_series_id is not null;
create index events_series_starts_idx on public.events(event_series_id, starts_at);

alter table public.event_series enable row level security;
create policy system_admin_all_event_series on public.event_series for all to authenticated
  using (public.is_active_system_admin()) with check (public.is_active_system_admin());
create policy host_read_event_series on public.event_series for select to authenticated
  using (exists (select 1 from public.events e where e.event_series_id = event_series.id and public.has_event_access(e.id)));
grant select, insert, update on public.event_series to authenticated;

create trigger event_series_updated_at before update on public.event_series
for each row execute function public.set_updated_at();
create trigger event_series_no_delete before delete on public.event_series
for each row execute function public.prevent_application_delete();

drop view public.public_event_schedule;
create view public.public_event_schedule with (security_invoker = false) as
with upcoming as (
  select e.id, e.name, e.description, e.participant_instructions, e.starts_at, e.ends_at, e.timezone,
         e.capacity, e.registration_deadline, e.visibility, e.host_organization_id, e.venue_id,
         coalesce(s.public_slug, e.public_slug) as public_slug,
         o.name as host_organization_name, v.name as venue_name, v.street as venue_street,
         v.city as venue_city, v.state as venue_state, v.postal_code as venue_postal_code,
         (select count(*)::integer from public.registrations r where r.event_id = e.id and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE') as active_registration_count,
         row_number() over (partition by coalesce(e.event_series_id, e.id) order by e.starts_at) as occurrence_rank
  from public.events e
  join public.organizations o on o.id = e.host_organization_id and o.active_status = 'ACTIVE'
  join public.venues v on v.id = e.venue_id and v.organization_id = o.id and v.active_status = 'ACTIVE'
  left join public.event_series s on s.id = e.event_series_id
  where e.status = 'OPEN' and e.publication_status = 'PUBLISHED' and e.archived_at is null
    and e.starts_at > now() and (e.registration_opens_at is null or e.registration_opens_at <= now())
    and (e.registration_closes_at is null or e.registration_closes_at > now())
    and e.registration_paused_at is null and e.registration_deadline >= now()
    and (e.event_series_id is null or s.public_slug is not null)
)
select id, name, description, participant_instructions, starts_at, ends_at, timezone, capacity,
       registration_deadline, visibility, host_organization_id, venue_id, public_slug,
       host_organization_name, venue_name, venue_street, venue_city, venue_state, venue_postal_code,
       active_registration_count
from upcoming where occurrence_rank = 1;
grant select on public.public_event_schedule to anon, authenticated;

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
      when e.publication_status <> 'PUBLISHED' then 'UNPUBLISHED' when e.registration_deadline < now() then 'CLOSED' else 'FULL' end
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
