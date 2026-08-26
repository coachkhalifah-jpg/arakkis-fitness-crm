-- Store Event Card title presentation separately from uploaded image assets.
alter table public.events
  add column if not exists event_title_color text not null default '#FFFFFF';

alter table public.events
  drop constraint if exists events_title_color_check;

alter table public.events
  add constraint events_title_color_check
  check (event_title_color ~ '^#[0-9A-Fa-f]{6}$');

drop view if exists public.public_event_schedule;
create view public.public_event_schedule with (security_invoker = false) as
with upcoming as (
  select e.id, e.name, e.description, e.participant_instructions, e.event_title_color,
         e.starts_at, e.ends_at, e.timezone, e.capacity, e.registration_deadline, e.visibility,
         e.host_organization_id, coalesce(e.location_override_venue_id, e.venue_id) as venue_id,
         coalesce(s.public_slug, e.public_slug) as public_slug,
         o.name as host_organization_name, v.name as venue_name, v.street as venue_street,
         v.city as venue_city, v.state as venue_state, v.postal_code as venue_postal_code,
         (select count(*)::integer from public.registrations r
          where r.event_id = e.id and r.registration_status = 'REGISTERED'
            and r.registration_outcome = 'ACTIVE') as active_registration_count,
         row_number() over (partition by coalesce(e.event_series_id, e.id) order by e.starts_at) as occurrence_rank
  from public.events e
  join public.organizations o on o.id = e.host_organization_id and o.active_status = 'ACTIVE'
  join public.venues v on v.id = coalesce(e.location_override_venue_id, e.venue_id)
    and v.organization_id = o.id and v.active_status = 'ACTIVE'
  left join public.event_series s on s.id = e.event_series_id
  where e.status = 'OPEN' and e.publication_status = 'PUBLISHED' and e.archived_at is null
    and e.starts_at > now() and (e.registration_opens_at is null or e.registration_opens_at <= now())
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

create or replace function public.get_registration_confirmation(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_group_id uuid; v_token_id uuid; v_result jsonb;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{40,60}$' then
    raise exception 'invalid confirmation' using errcode = '42501';
  end if;
  select ct.id, ct.registration_group_id into v_token_id, v_group_id
  from public.confirmation_tokens ct
  where ct.token_hash = digest(p_token, 'sha256') and ct.revoked_at is null and ct.expires_at > now()
  for update;
  if v_group_id is null or not exists (
    select 1 from public.registration_group_results gr
    where gr.registration_group_id = v_group_id and gr.success
  ) then raise exception 'invalid confirmation' using errcode = '42501'; end if;
  update public.confirmation_tokens
  set last_accessed_at = now(), access_count = access_count + 1
  where id = v_token_id;
  select jsonb_build_object(
    'participant_name', p.first_name || ' ' || p.last_name,
    'registration_group_id', rg.id,
    'expires_at', ct.expires_at,
    'events', coalesce(jsonb_agg(jsonb_build_object(
      'event_id', e.id, 'registration_id', r.id, 'success', gr.success, 'reason', gr.reason,
      'name', e.name, 'description', e.description, 'participant_instructions', e.participant_instructions,
      'event_title_color', e.event_title_color, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
      'timezone', e.timezone, 'venue_name', v.name, 'venue_street', v.street,
      'venue_city', v.city, 'venue_state', v.state, 'venue_postal_code', v.postal_code,
      'host_organization_name', o.name,
      'communication_url', case when gr.success then e.communication_url else null end,
      'communication_label', case when gr.success then e.communication_label else null end
    ) order by e.starts_at), '[]'::jsonb)
  ) into v_result
  from public.registration_groups rg
  join public.participants p on p.id = rg.participant_id
  join public.confirmation_tokens ct on ct.registration_group_id = rg.id
  join public.registration_group_results gr on gr.registration_group_id = rg.id
  left join public.registrations r on r.id = gr.registration_id
  left join public.events e on e.id = gr.event_id
  left join public.venues v on v.id = coalesce(e.location_override_venue_id, e.venue_id)
  left join public.organizations o on o.id = e.host_organization_id
  where rg.id = v_group_id
  group by p.first_name, p.last_name, rg.id, ct.expires_at;
  return v_result;
end; $$;

revoke all on function public.get_registration_confirmation(text) from public;
grant execute on function public.get_registration_confirmation(text) to anon, authenticated;
