-- Event Access: public, unlisted, and reusable event-bound invite-only links.
-- This is intentionally separate from account-bound admin invitations.

alter table public.events
  add column if not exists access_mode text not null default 'PUBLIC';

alter table public.events drop constraint if exists events_access_mode_check;
alter table public.events add constraint events_access_mode_check
  check (access_mode in ('PUBLIC', 'UNLISTED', 'INVITE_ONLY'));

create table if not exists public.event_invite_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  created_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict,
  expires_at timestamptz,
  revoked_at timestamptz,
  constraint event_invite_expiry_check check (expires_at is null or expires_at > created_at)
);

create index if not exists event_invite_links_event_idx
  on public.event_invite_links(event_id, revoked_at, expires_at);

revoke all on public.event_invite_links from public, anon, authenticated;

create or replace function public.phase10_event_access_allows(
  p_event_ids uuid[],
  p_invite_token text default null
)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token_hash bytea;
  v_invite_event_id uuid;
begin
  if p_event_ids is null or cardinality(p_event_ids) = 0 then return false; end if;
  if p_invite_token is not null then
    if p_invite_token !~ '^[A-Za-z0-9_-]{40,60}$' then return false; end if;
    v_token_hash := digest(p_invite_token, 'sha256');
    select event_id into v_invite_event_id
      from public.event_invite_links
     where token_hash = v_token_hash and revoked_at is null
       and (expires_at is null or expires_at > now());
    if v_invite_event_id is null then return false; end if;
  end if;
  return not exists (
    select 1 from public.events e
    where e.id = any(p_event_ids)
      and (
        e.access_mode = 'INVITE_ONLY'
        and (v_invite_event_id is null or e.id <> v_invite_event_id)
        or e.access_mode not in ('PUBLIC', 'UNLISTED', 'INVITE_ONLY')
      )
  );
end;
$$;

revoke all on function public.phase10_event_access_allows(uuid[], text) from public, anon, authenticated;

-- The public projection is deliberately limited to Public events.
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
      and v.organization_id = o.id and v.active_status = 'ACTIVE'
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
    'availability', case when public.phase7_registration_available(e.id) then 'OPEN'
      when e.status = 'CANCELLED' then 'CANCELLED'
      when e.publication_status <> 'PUBLISHED' then 'UNPUBLISHED'
      when e.registration_paused_at is not null then 'PAUSED'
      when e.registration_deadline < now() then 'CLOSED' else 'FULL' end,
    'capacity', e.capacity,
    'active_registration_count', (select count(*)::integer from public.registrations r
      where r.event_id = e.id and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE'),
    'series_slug', s.public_slug,
    'occurrences', case when s.id is null then jsonb_build_array(jsonb_build_object(
      'id', e.id, 'name', e.name, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
      'timezone', e.timezone, 'capacity', e.capacity,
      'active_registration_count', (select count(*)::integer from public.registrations r2
        where r2.event_id = e.id and r2.registration_status = 'REGISTERED' and r2.registration_outcome = 'ACTIVE'),
      'venue_name', v.name, 'venue_street', v.street, 'venue_city', v.city,
      'venue_state', v.state, 'venue_postal_code', v.postal_code,
      'host_organization_name', o.name
    )) else coalesce((select jsonb_agg(jsonb_build_object(
      'id', e2.id, 'name', e2.name, 'starts_at', e2.starts_at, 'ends_at', e2.ends_at,
      'timezone', e2.timezone, 'capacity', e2.capacity,
      'active_registration_count', (select count(*)::integer from public.registrations r3
        where r3.event_id = e2.id and r3.registration_status = 'REGISTERED' and r3.registration_outcome = 'ACTIVE'),
      'venue_name', v2.name, 'venue_street', v2.street, 'venue_city', v2.city,
      'venue_state', v2.state, 'venue_postal_code', v2.postal_code,
      'host_organization_name', o2.name
    ) order by e2.starts_at) from public.events e2
      join public.organizations o2 on o2.id = e2.host_organization_id and o2.active_status = 'ACTIVE'
      join public.venues v2 on v2.id = coalesce(e2.location_override_venue_id, e2.venue_id)
        and v2.organization_id = o2.id and v2.active_status = 'ACTIVE'
      where e2.event_series_id = s.id and e2.archived_at is null and e2.status = 'OPEN'
        and e2.starts_at > now() and public.phase10_event_access_allows(array[e2.id], p_invite_token)), '[]'::jsonb) end
  )
    from public.events e
    join public.organizations o on o.id = e.host_organization_id and o.active_status = 'ACTIVE'
    join public.venues v on v.id = coalesce(e.location_override_venue_id, e.venue_id)
      and v.organization_id = o.id and v.active_status = 'ACTIVE'
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

-- Prevent direct anonymous calls to the legacy lookup and registration writer.
revoke all on function public.get_public_event_by_slug(text) from public, anon, authenticated;
revoke all on function public.register_selected_events_with_legal(
  text,text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[],uuid
) from public, anon, authenticated;

create or replace function public.register_selected_events_with_access(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_event_ids uuid[];
  v_result jsonb;
begin
  select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_event_ids
    from jsonb_array_elements_text(coalesce(p_payload->'event_ids', '[]'::jsonb));
  if not public.phase10_event_access_allows(v_event_ids, nullif(p_payload->>'event_access_token', '')) then
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
