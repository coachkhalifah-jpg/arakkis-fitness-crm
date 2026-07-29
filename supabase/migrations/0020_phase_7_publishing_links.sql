-- Phase 7: additive publication metadata, canonical event lookup, and database availability guard.
-- Migrations 0001-0019 are immutable.

alter table public.events
  add column if not exists publication_status text not null default 'DRAFT',
  add column if not exists public_slug text,
  add column if not exists registration_opens_at timestamptz,
  add column if not exists registration_closes_at timestamptz,
  add column if not exists registration_paused_at timestamptz,
  add column if not exists last_published_at timestamptz,
  add column if not exists published_by_admin_id uuid references public.admin_profiles(id) on delete restrict;

alter table public.events drop constraint if exists events_publication_status_check;
alter table public.events add constraint events_publication_status_check
  check (publication_status in ('DRAFT', 'PUBLISHED', 'UNPUBLISHED'));
alter table public.events drop constraint if exists events_public_slug_check;
alter table public.events add constraint events_public_slug_check
  check (public_slug is null or (char_length(public_slug) between 1 and 80 and public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'));
alter table public.events drop constraint if exists events_registration_window_check;
alter table public.events add constraint events_registration_window_check
  check (registration_closes_at is null or registration_opens_at is null or registration_closes_at > registration_opens_at);

update public.events set publication_status = 'PUBLISHED' where status = 'OPEN' and publication_status = 'DRAFT';
create unique index if not exists events_public_slug_uq on public.events(public_slug) where public_slug is not null;
create index if not exists events_publication_lookup_idx on public.events(publication_status, public_slug);

create or replace function public.phase7_event_publication_defaults()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Preserve Phase 1-6 callers that create an OPEN event without the additive field.
  if new.status = 'OPEN' and new.publication_status = 'DRAFT' then
    new.publication_status := 'PUBLISHED';
    if new.last_published_at is null then new.last_published_at := now(); end if;
  end if;
  return new;
end; $$;
drop trigger if exists phase7_event_publication_defaults on public.events;
create trigger phase7_event_publication_defaults before insert or update of status, publication_status on public.events
for each row execute function public.phase7_event_publication_defaults();

drop view public.public_event_schedule;
create view public.public_event_schedule with (security_invoker = false) as
select e.id, e.name, e.description, e.participant_instructions, e.starts_at, e.ends_at, e.timezone, e.capacity,
       e.registration_deadline, e.visibility, e.host_organization_id, e.venue_id, e.public_slug,
       o.name as host_organization_name, v.name as venue_name, v.street as venue_street,
       v.city as venue_city, v.state as venue_state, v.postal_code as venue_postal_code,
       (select count(*)::integer from public.registrations r where r.event_id = e.id
        and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE') as active_registration_count
from public.events e
join public.organizations o on o.id = e.host_organization_id and o.active_status = 'ACTIVE'
join public.venues v on v.id = e.venue_id and v.organization_id = o.id and v.active_status = 'ACTIVE'
where e.status = 'OPEN' and e.publication_status = 'PUBLISHED' and e.archived_at is null
  and e.starts_at > now() and (e.registration_opens_at is null or e.registration_opens_at <= now())
  and (e.registration_closes_at is null or e.registration_closes_at > now())
  and e.registration_paused_at is null and e.registration_deadline >= now();
grant select on public.public_event_schedule to anon, authenticated;

create or replace function public.phase7_registration_available(p_event_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare e public.events%rowtype; active_count integer;
begin
  if not public.phase7_registration_legal_allowed() then return false; end if;
  select * into e from public.events where id = p_event_id;
  if not found or e.archived_at is not null or e.status <> 'OPEN' or e.publication_status <> 'PUBLISHED'
     or e.registration_paused_at is not null or e.starts_at <= now()
     or (e.registration_opens_at is not null and e.registration_opens_at > now())
     or (e.registration_closes_at is not null and e.registration_closes_at <= now())
     or e.registration_deadline < now()
     or not exists (select 1 from public.organizations o join public.venues v on v.id = e.venue_id and v.organization_id = o.id
                    where o.id = e.host_organization_id and o.active_status = 'ACTIVE' and v.active_status = 'ACTIVE') then
    return false;
  end if;
  select count(*) into active_count from public.registrations r
    where r.event_id = e.id and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE';
  return active_count < e.capacity;
end; $$;
revoke all on function public.phase7_registration_available(uuid) from public, anon, authenticated;
grant execute on function public.phase7_registration_available(uuid) to anon, authenticated, service_role;

create or replace function public.phase7_registration_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare source public.submission_source; event_status public.event_status;
begin
  select submission_source into source from public.registration_groups where id = new.registration_group_id;
  if source is distinct from 'PUBLIC' then return new; end if;
  select status into event_status from public.events where id = new.event_id;
  if event_status is distinct from 'OPEN' then return new; end if;
  if new.registration_status = 'REGISTERED' and new.registration_outcome = 'ACTIVE'
     and not public.phase7_registration_available(new.event_id) then
    raise exception 'event registration is unavailable' using errcode = '42501';
  end if;
  return new;
end; $$;
drop trigger if exists phase7_registration_guard on public.registrations;
create trigger phase7_registration_guard before insert on public.registrations
for each row execute function public.phase7_registration_guard();

create or replace function public.get_public_event_by_slug(p_slug text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then return null; end if;
  select jsonb_build_object(
    'name', e.name, 'description', e.description, 'participant_instructions', e.participant_instructions,
    'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone, 'capacity', e.capacity,
    'active_registration_count', (select count(*)::integer from public.registrations r where r.event_id = e.id and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE'),
    'registration_deadline', e.registration_deadline, 'visibility', e.visibility,
    'host_organization_name', o.name, 'venue_name', v.name, 'venue_street', v.street,
    'venue_city', v.city, 'venue_state', v.state,
    'availability', case when not public.phase7_registration_legal_allowed() then 'LEGALLY_BLOCKED'
      when public.phase7_registration_available(e.id) then 'OPEN'
      when e.status = 'CANCELLED' then 'CANCELLED'
      when e.publication_status <> 'PUBLISHED' then 'UNPUBLISHED'
      when e.registration_paused_at is not null then 'PAUSED'
      when e.registration_opens_at is not null and e.registration_opens_at > now() then 'NOT_YET_OPEN'
      when e.registration_closes_at is not null and e.registration_closes_at <= now() then 'CLOSED'
      else 'FULL' end
  ) into result
  from public.events e join public.organizations o on o.id = e.host_organization_id and o.active_status = 'ACTIVE'
  join public.venues v on v.id = e.venue_id and v.active_status = 'ACTIVE'
  where e.public_slug = lower(btrim(p_slug)) and e.archived_at is null;
  return result;
end; $$;
revoke all on function public.get_public_event_by_slug(text) from public;
grant execute on function public.get_public_event_by_slug(text) to anon, authenticated;

create or replace function public.regenerate_admin_invitation(
  p_invitation_id uuid, p_token_hash bytea, p_token_expires_at timestamptz, p_actor_admin_id uuid
)
returns boolean language plpgsql security definer set search_path = public as $$
declare changed integer;
begin
  if not exists (select 1 from public.admin_profiles where id = p_actor_admin_id and role = 'SYSTEM_ADMIN' and status = 'ACTIVE')
     or p_token_hash is null or p_token_expires_at <= now() then
    raise exception 'administrator is not authorized' using errcode = '42501';
  end if;
  update public.admin_invitations
    set token_hash = p_token_hash, token_expires_at = p_token_expires_at,
        issued_at = now(), status = 'PENDING', revoked_at = null
    where id = p_invitation_id and status = 'PENDING';
  get diagnostics changed = row_count;
  if changed > 0 then
    insert into public.audit_events (actor_admin_id, action, entity_type, entity_id, new_values)
      values (p_actor_admin_id, 'ADMIN_INVITATION_REGENERATED', 'ADMIN_INVITATION', p_invitation_id,
              jsonb_build_object('expires_at', p_token_expires_at));
  end if;
  return changed > 0;
end; $$;
revoke all on function public.regenerate_admin_invitation(uuid, bytea, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.regenerate_admin_invitation(uuid, bytea, timestamptz, uuid) to service_role;
