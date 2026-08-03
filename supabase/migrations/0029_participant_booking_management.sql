-- Prompt 3: occurrence-aware participant booking management.
-- The existing materialized public.events rows are the Event Occurrences.

alter table public.events
  add column if not exists location_override_venue_id uuid references public.venues(id) on delete restrict,
  add column if not exists location_override_at timestamptz,
  add column if not exists location_override_by_admin_id uuid references public.admin_profiles(id) on delete restrict,
  add column if not exists location_override_note text;

alter table public.events
  add constraint events_location_override_metadata_check check (
    (location_override_venue_id is null and location_override_at is null and location_override_by_admin_id is null)
    or location_override_venue_id is not null
  );

drop view if exists public.public_event_schedule;
create view public.public_event_schedule with (security_invoker = false) as
with upcoming as (
  select e.id, e.name, e.description, e.participant_instructions, e.starts_at, e.ends_at, e.timezone,
         e.capacity, e.registration_deadline, e.visibility, e.host_organization_id,
         coalesce(e.location_override_venue_id, e.venue_id) as venue_id,
         coalesce(s.public_slug, e.public_slug) as public_slug,
         o.name as host_organization_name, v.name as venue_name, v.street as venue_street,
         v.city as venue_city, v.state as venue_state, v.postal_code as venue_postal_code,
         (select count(*)::integer from public.registrations r where r.event_id=e.id and r.registration_status='REGISTERED' and r.registration_outcome='ACTIVE') as active_registration_count,
         row_number() over (partition by coalesce(e.event_series_id,e.id) order by e.starts_at) as occurrence_rank
    from public.events e
    join public.organizations o on o.id=e.host_organization_id and o.active_status='ACTIVE'
    join public.venues v on v.id=coalesce(e.location_override_venue_id,e.venue_id) and v.organization_id=o.id and v.active_status='ACTIVE'
    left join public.event_series s on s.id=e.event_series_id
   where e.status='OPEN' and e.publication_status='PUBLISHED' and e.archived_at is null and e.starts_at>now()
     and (e.registration_opens_at is null or e.registration_opens_at<=now()) and (e.registration_closes_at is null or e.registration_closes_at>now())
     and e.registration_paused_at is null and e.registration_deadline>=now() and (e.event_series_id is null or s.public_slug is not null)
)
select id,name,description,participant_instructions,starts_at,ends_at,timezone,capacity,registration_deadline,visibility,host_organization_id,venue_id,public_slug,host_organization_name,venue_name,venue_street,venue_city,venue_state,venue_postal_code,active_registration_count
from upcoming where occurrence_rank=1;
grant select on public.public_event_schedule to anon, authenticated;

create or replace function public.get_public_event_by_slug(p_slug text)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'id', e.id, 'name', e.name, 'description', e.description, 'participant_instructions', e.participant_instructions,
    'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone, 'capacity', e.capacity,
    'active_registration_count', (select count(*)::integer from public.registrations r where r.event_id=e.id and r.registration_status='REGISTERED' and r.registration_outcome='ACTIVE'),
    'registration_deadline', e.registration_deadline, 'visibility', e.visibility, 'host_organization_name', o.name,
    'venue_name', v.name, 'venue_street', v.street, 'venue_city', v.city, 'venue_state', v.state,
    'venue_postal_code', v.postal_code, 'series_slug', s.public_slug,
    'occurrences', case when s.id is null then jsonb_build_array(jsonb_build_object(
      'id', e.id, 'name', e.name, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
      'capacity', e.capacity, 'active_registration_count', (select count(*)::integer from public.registrations r2 where r2.event_id=e.id and r2.registration_status='REGISTERED' and r2.registration_outcome='ACTIVE'),
      'venue_name', v.name, 'venue_street', v.street, 'venue_city', v.city, 'venue_state', v.state, 'venue_postal_code', v.postal_code,
      'host_organization_name', o.name
    )) else coalesce((select jsonb_agg(jsonb_build_object(
      'id', e2.id, 'name', e2.name, 'starts_at', e2.starts_at, 'ends_at', e2.ends_at, 'timezone', e2.timezone,
      'capacity', e2.capacity, 'active_registration_count', (select count(*)::integer from public.registrations r3 where r3.event_id=e2.id and r3.registration_status='REGISTERED' and r3.registration_outcome='ACTIVE'),
      'venue_name', v2.name, 'venue_street', v2.street, 'venue_city', v2.city, 'venue_state', v2.state, 'venue_postal_code', v2.postal_code,
      'host_organization_name', o2.name
    ) order by e2.starts_at) from public.events e2
      join public.organizations o2 on o2.id=e2.host_organization_id and o2.active_status='ACTIVE'
      join public.venues v2 on v2.id=coalesce(e2.location_override_venue_id,e2.venue_id) and v2.active_status='ACTIVE'
      where e2.event_series_id=s.id and e2.archived_at is null and e2.status='OPEN' and e2.starts_at>now() and e2.starts_at<=now()+interval '14 days'), '[]'::jsonb) end,
    'availability', case when not public.phase7_registration_legal_allowed() then 'LEGALLY_BLOCKED'
      when public.phase7_registration_available(e.id) then 'OPEN' when e.status='CANCELLED' then 'CANCELLED'
      when e.publication_status<>'PUBLISHED' then 'UNPUBLISHED' when e.registration_paused_at is not null then 'PAUSED'
      when e.registration_deadline<now() then 'CLOSED' else 'FULL' end
  )
  from public.events e
  join public.organizations o on o.id=e.host_organization_id and o.active_status='ACTIVE'
  join public.venues v on v.id=coalesce(e.location_override_venue_id,e.venue_id) and v.organization_id=o.id and v.active_status='ACTIVE'
  left join public.event_series s on s.id=e.event_series_id
  where p_slug is not null and p_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and e.archived_at is null
    and ((e.public_slug=lower(btrim(p_slug))) or (s.public_slug=lower(btrim(p_slug)))) and e.starts_at>now()
  order by e.starts_at limit 1;
$$;
revoke all on function public.get_public_event_by_slug(text) from public;
grant execute on function public.get_public_event_by_slug(text) to anon, authenticated;

create or replace function public.get_registration_confirmation(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_group_id uuid; v_token_id uuid; v_result jsonb;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{40,60}$' then raise exception 'invalid confirmation' using errcode='42501'; end if;
  select ct.id,ct.registration_group_id into v_token_id,v_group_id from public.confirmation_tokens ct
   where ct.token_hash=digest(p_token,'sha256') and ct.revoked_at is null and ct.expires_at>now() for update;
  if v_group_id is null or not exists (select 1 from public.registration_group_results gr where gr.registration_group_id=v_group_id and gr.success) then raise exception 'invalid confirmation' using errcode='42501'; end if;
  update public.confirmation_tokens set last_accessed_at=now(),access_count=access_count+1 where id=v_token_id;
  select jsonb_build_object('participant_name',p.first_name||' '||p.last_name,'registration_group_id',rg.id,'expires_at',ct.expires_at,
    'events',coalesce(jsonb_agg(jsonb_build_object('event_id',e.id,'registration_id',r.id,'success',gr.success,'reason',gr.reason,'name',e.name,'description',e.description,'participant_instructions',e.participant_instructions,'starts_at',e.starts_at,'ends_at',e.ends_at,'timezone',e.timezone,'venue_name',v.name,'venue_street',v.street,'venue_city',v.city,'venue_state',v.state,'venue_postal_code',v.postal_code,'host_organization_name',o.name) order by e.starts_at),'[]'::jsonb)) into v_result
    from public.registration_groups rg join public.participants p on p.id=rg.participant_id join public.confirmation_tokens ct on ct.registration_group_id=rg.id
    join public.registration_group_results gr on gr.registration_group_id=rg.id left join public.registrations r on r.id=gr.registration_id left join public.events e on e.id=gr.event_id
    left join public.venues v on v.id=coalesce(e.location_override_venue_id,e.venue_id) left join public.organizations o on o.id=e.host_organization_id
   where rg.id=v_group_id group by p.first_name,p.last_name,rg.id,ct.expires_at;
  return v_result;
end; $$;
revoke all on function public.get_registration_confirmation(text) from public;
grant execute on function public.get_registration_confirmation(text) to anon, authenticated;

create index if not exists events_location_override_idx on public.events(location_override_venue_id)
  where location_override_venue_id is not null;

create table public.participant_booking_management_tokens (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete restrict,
  token_hash bytea not null unique,
  email text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  constraint participant_booking_token_expiry check (expires_at > issued_at),
  constraint participant_booking_token_email check (email = lower(btrim(email)))
);
create index participant_booking_tokens_active_idx
  on public.participant_booking_management_tokens (participant_id, expires_at)
  where consumed_at is null and revoked_at is null;
alter table public.participant_booking_management_tokens enable row level security;
revoke all on public.participant_booking_management_tokens from anon, authenticated;

create table public.participant_booking_audits (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete restrict,
  registration_id uuid not null references public.registrations(id) on delete restrict,
  action text not null check (action in ('VIEWED', 'CANCELLED', 'TRANSFERRED', 'RESTORED', 'ORGANIZER_CANCELLED')),
  source_event_id uuid not null references public.events(id) on delete restrict,
  target_event_id uuid references public.events(id) on delete restrict,
  old_venue_id uuid references public.venues(id) on delete restrict,
  new_venue_id uuid references public.venues(id) on delete restrict,
  result text not null check (result in ('SUCCESS', 'REJECTED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index participant_booking_audits_participant_idx
  on public.participant_booking_audits (participant_id, created_at desc);
alter table public.participant_booking_audits enable row level security;
revoke all on public.participant_booking_audits from anon, authenticated;

create or replace function public.phase10_actual_venue_id(p_event_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(e.location_override_venue_id, e.venue_id)
  from public.events e where e.id = p_event_id;
$$;
revoke all on function public.phase10_actual_venue_id(uuid) from public;

create or replace function public.phase10_resolve_booking_participant(p_token text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_participant_id uuid;
begin
  if p_token is null or char_length(p_token) < 32 then return null; end if;
  select participant_id into v_participant_id
    from public.participant_remembered_devices
   where token_hash = digest(p_token, 'sha256') and revoked_at is null and expires_at > now();
  if v_participant_id is not null then
    update public.participant_remembered_devices set last_used_at = now()
     where token_hash = digest(p_token, 'sha256');
    return v_participant_id;
  end if;
  select participant_id into v_participant_id
    from public.participant_booking_management_tokens
   where token_hash = digest(p_token, 'sha256') and revoked_at is null
     and consumed_at is null and expires_at > now();
  if v_participant_id is not null then
    update public.participant_booking_management_tokens set consumed_at = now()
     where token_hash = digest(p_token, 'sha256');
  end if;
  return v_participant_id;
end;
$$;

create or replace function public.get_participant_upcoming_bookings(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_participant_id uuid; v_result jsonb;
begin
  v_participant_id := public.phase10_resolve_booking_participant(p_token);
  if v_participant_id is null then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'registration_id', r.id, 'event_id', e.id, 'name', e.name,
    'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
    'venue_name', v.name, 'venue_street', v.street, 'venue_city', v.city,
    'venue_state', v.state, 'venue_postal_code', v.postal_code,
    'host_organization_name', o.name, 'location_updated', e.location_override_venue_id is not null,
    'registration_status', r.registration_status, 'registration_outcome', r.registration_outcome,
    'series_slug', s.public_slug
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

create or replace function public.get_participant_booking_alternatives(p_token text, p_registration_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_participant_id uuid; v_source public.registrations; v_series uuid; v_result jsonb;
begin
  v_participant_id := public.phase10_resolve_booking_participant(p_token);
  if v_participant_id is null then return null; end if;
  select * into v_source from public.registrations where id = p_registration_id and participant_id = v_participant_id;
  if not found then return null; end if;
  select event_series_id into v_series from public.events where id = v_source.event_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'event_id', e.id, 'name', e.name, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
    'timezone', e.timezone, 'venue_name', v.name, 'venue_street', v.street,
    'venue_city', v.city, 'venue_state', v.state, 'venue_postal_code', v.postal_code,
    'host_organization_name', o.name, 'capacity', e.capacity,
    'active_registration_count', (select count(*)::integer from public.registrations r2 where r2.event_id=e.id and r2.registration_status='REGISTERED' and r2.registration_outcome='ACTIVE'),
    'location_updated', e.location_override_venue_id is not null
  ) order by e.starts_at), '[]'::jsonb) into v_result
  from public.events e
  join public.organizations o on o.id=e.host_organization_id and o.active_status='ACTIVE'
  join public.venues v on v.id=coalesce(e.location_override_venue_id,e.venue_id) and v.active_status='ACTIVE'
  where v_series is not null and e.event_series_id = v_series and e.id <> v_source.event_id
    and e.starts_at > now() and e.starts_at <= now() + interval '14 days'
    and e.status='OPEN' and e.publication_status='PUBLISHED' and e.registration_paused_at is null
    and e.registration_deadline >= now() and not exists (
      select 1 from public.registrations r3 where r3.participant_id=v_participant_id and r3.event_id=e.id
        and r3.registration_status='REGISTERED' and r3.registration_outcome='ACTIVE'
    ) and (select count(*) from public.registrations r4 where r4.event_id=e.id and r4.registration_status='REGISTERED' and r4.registration_outcome='ACTIVE') < e.capacity;
  return v_result;
end;
$$;

create or replace function public.manage_participant_booking(
  p_token text, p_action text, p_registration_id uuid, p_target_event_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_participant_id uuid; v_source public.registrations; v_source_event public.events; v_target public.events; v_target_venue uuid; v_new_id uuid;
begin
  v_participant_id := public.phase10_resolve_booking_participant(p_token);
  if v_participant_id is null then raise exception 'booking access is invalid' using errcode='42501'; end if;
  select r.* into v_source from public.registrations r where r.id=p_registration_id and r.participant_id=v_participant_id for update;
  if not found then raise exception 'booking was not found' using errcode='42501'; end if;
  select * into v_source_event from public.events where id=v_source.event_id for update;
  if p_action='CANCEL' then
    if v_source.registration_status <> 'REGISTERED' or v_source.registration_outcome <> 'ACTIVE' then raise exception 'booking is not active'; end if;
    if v_source_event.starts_at <= now() then raise exception 'booking can no longer be cancelled'; end if;
    update public.registrations set registration_status='CANCELLED', registration_outcome='PARTICIPANT_CANCELLED', cancelled_at=now(), cancellation_reason='Participant cancelled booking' where id=v_source.id;
    insert into public.participant_booking_audits(participant_id,registration_id,action,source_event_id,old_venue_id,new_venue_id,result,metadata)
      values(v_participant_id,v_source.id,'CANCELLED',v_source.event_id,public.phase10_actual_venue_id(v_source.event_id),public.phase10_actual_venue_id(v_source.event_id),'SUCCESS',jsonb_build_object('cancellation_policy','NO_PAYMENT_EXECUTED'));
    return jsonb_build_object('status','CANCELLED','registration_id',v_source.id);
  elsif p_action='RESTORE' then
    if v_source.registration_status <> 'CANCELLED' or v_source.registration_outcome <> 'PARTICIPANT_CANCELLED' then raise exception 'only participant-cancelled bookings can be restored'; end if;
    if v_source_event.starts_at <= now() or v_source_event.status <> 'OPEN' or v_source_event.publication_status <> 'PUBLISHED' or v_source_event.registration_paused_at is not null or v_source_event.registration_deadline < now() then raise exception 'booking is no longer bookable'; end if;
    if not exists (select 1 from public.venues v where v.id=public.phase10_actual_venue_id(v_source.event_id) and v.active_status='ACTIVE') then raise exception 'venue is unavailable'; end if;
    if exists (select 1 from public.registrations r where r.participant_id=v_participant_id and r.event_id=v_source.event_id and r.id<>v_source.id and r.registration_status='REGISTERED' and r.registration_outcome='ACTIVE') then raise exception 'booking already exists'; end if;
    if (select count(*) from public.registrations r where r.event_id=v_source.event_id and r.registration_status='REGISTERED' and r.registration_outcome='ACTIVE') >= v_source_event.capacity then raise exception 'booking is full'; end if;
    update public.registrations set registration_status='REGISTERED', registration_outcome='ACTIVE', cancelled_at=null, cancellation_reason=null where id=v_source.id;
    insert into public.participant_booking_audits(participant_id,registration_id,action,source_event_id,old_venue_id,new_venue_id,result,metadata)
      values(v_participant_id,v_source.id,'RESTORED',v_source.event_id,public.phase10_actual_venue_id(v_source.event_id),public.phase10_actual_venue_id(v_source.event_id),'SUCCESS','{}'::jsonb);
    return jsonb_build_object('status','REGISTERED','registration_id',v_source.id);
  elsif p_action='TRANSFER' then
    if v_source.registration_status <> 'REGISTERED' or v_source.registration_outcome <> 'ACTIVE' then raise exception 'booking is not active'; end if;
    if p_target_event_id is null then raise exception 'choose an alternative occurrence'; end if;
    select * into v_target from public.events where id=p_target_event_id for update;
    if not found or v_target.event_series_id is distinct from v_source_event.event_series_id or v_target.starts_at <= now() or v_target.status <> 'OPEN' or v_target.publication_status <> 'PUBLISHED' or v_target.registration_paused_at is not null or v_target.registration_deadline < now() then raise exception 'alternative occurrence is unavailable'; end if;
    if not exists (select 1 from public.venues v where v.id=public.phase10_actual_venue_id(v_target.id) and v.active_status='ACTIVE') then raise exception 'alternative venue is unavailable'; end if;
    if exists (select 1 from public.registrations r where r.participant_id=v_participant_id and r.event_id=v_target.id and r.registration_status='REGISTERED' and r.registration_outcome='ACTIVE') then raise exception 'booking already exists'; end if;
    if (select count(*) from public.registrations r where r.event_id=v_target.id and r.registration_status='REGISTERED' and r.registration_outcome='ACTIVE') >= v_target.capacity then raise exception 'alternative occurrence is full'; end if;
    insert into public.registrations(registration_group_id,participant_id,event_id,affiliation_organization_id_at_registration,affiliation_other_text_at_registration,registration_status,registration_outcome,created_by_admin_id,referral_source,referral_source_other_text)
      values(v_source.registration_group_id,v_participant_id,v_target.id,v_source.affiliation_organization_id_at_registration,v_source.affiliation_other_text_at_registration,'REGISTERED','ACTIVE',null,v_source.referral_source,v_source.referral_source_other_text) returning id into v_new_id;
    update public.registrations set registration_status='CANCELLED',registration_outcome='PARTICIPANT_CANCELLED',cancelled_at=now(),cancellation_reason='Transferred to another occurrence' where id=v_source.id;
    insert into public.participant_booking_audits(participant_id,registration_id,action,source_event_id,target_event_id,old_venue_id,new_venue_id,result,metadata)
      values(v_participant_id,v_source.id,'TRANSFERRED',v_source.event_id,v_target.id,public.phase10_actual_venue_id(v_source.event_id),public.phase10_actual_venue_id(v_target.id),'SUCCESS',jsonb_build_object('new_registration_id',v_new_id));
    return jsonb_build_object('status','TRANSFERRED','registration_id',v_new_id,'source_registration_id',v_source.id);
  else
    raise exception 'unsupported booking action';
  end if;
end;
$$;

revoke all on function public.get_participant_upcoming_bookings(text) from public;
revoke all on function public.get_participant_booking_alternatives(text,uuid) from public;
revoke all on function public.manage_participant_booking(text,text,uuid,uuid) from public;
grant execute on function public.get_participant_upcoming_bookings(text) to service_role;
grant execute on function public.get_participant_booking_alternatives(text,uuid) to service_role;
grant execute on function public.manage_participant_booking(text,text,uuid,uuid) to service_role;
