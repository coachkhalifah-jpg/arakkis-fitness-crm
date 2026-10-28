-- DEC-W1 — Capped demand waitlist (max 5, no promote).
-- Per-occurrence interest capture only; does not create registrations or
-- count toward DEC-009 active-registration capacity.

create table public.event_waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  display_name text not null,
  contact text not null,
  normalized_contact text not null,
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  remove_token_hash bytea not null,
  created_at timestamptz not null default now(),
  constraint event_waitlist_display_name_nonempty check (char_length(btrim(display_name)) > 0),
  constraint event_waitlist_display_name_len check (char_length(btrim(display_name)) <= 200),
  constraint event_waitlist_contact_nonempty check (char_length(btrim(contact)) > 0),
  constraint event_waitlist_contact_len check (char_length(btrim(contact)) <= 254),
  constraint event_waitlist_normalized_contact_nonempty check (char_length(normalized_contact) > 0),
  constraint event_waitlist_removed_after_joined check (removed_at is null or removed_at >= joined_at)
);

comment on table public.event_waitlist_entries is
  'DEC-W1 capped demand waitlist (max 5 active per occurrence). Not a registration; no promote.';

create unique index event_waitlist_remove_token_hash_uq
  on public.event_waitlist_entries (remove_token_hash);

create unique index event_waitlist_active_contact_uq
  on public.event_waitlist_entries (event_id, normalized_contact)
  where removed_at is null;

create index event_waitlist_event_active_joined_idx
  on public.event_waitlist_entries (event_id, joined_at)
  where removed_at is null;

alter table public.event_waitlist_entries enable row level security;
revoke all on public.event_waitlist_entries from anon, authenticated;

create policy system_admin_all_event_waitlist_entries
  on public.event_waitlist_entries
  for all
  to authenticated
  using (public.is_active_system_admin())
  with check (public.is_active_system_admin());

create policy host_read_event_waitlist_entries
  on public.event_waitlist_entries
  for select
  to authenticated
  using (public.has_event_access(event_id));

-- Soft-remove only; hard deletes remain blocked by application policy.
create trigger event_waitlist_entries_no_delete
  before delete on public.event_waitlist_entries
  for each row execute function public.prevent_application_delete();

create or replace function public.normalize_waitlist_contact(p_contact text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(btrim(coalesce(p_contact, '')));
$$;
revoke all on function public.normalize_waitlist_contact(text) from public;
grant execute on function public.normalize_waitlist_contact(text) to anon, authenticated, service_role;

create or replace function public.event_waitlist_active_count(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.event_waitlist_entries w
  where w.event_id = p_event_id
    and w.removed_at is null;
$$;
revoke all on function public.event_waitlist_active_count(uuid) from public;
grant execute on function public.event_waitlist_active_count(uuid) to anon, authenticated, service_role;

-- True when the occurrence is at registration capacity but otherwise would be
-- joinable for demand waitlist (legal gate + published/open window).
create or replace function public.phase_w1_waitlist_eligible(p_event_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  e public.events%rowtype;
  active_count integer;
begin
  if not public.phase7_registration_legal_allowed() then
    return false;
  end if;
  select * into e from public.events where id = p_event_id;
  if not found
     or e.archived_at is not null
     or e.status <> 'OPEN'
     or e.publication_status <> 'PUBLISHED'
     or e.registration_paused_at is not null
     or e.starts_at <= now()
     or (e.registration_opens_at is not null and e.registration_opens_at > now())
     or (e.registration_closes_at is not null and e.registration_closes_at <= now())
     or e.registration_deadline < now()
     or not exists (
       select 1
       from public.organizations o
       join public.venues v on v.id = coalesce(e.location_override_venue_id, e.venue_id)
         and v.active_status = 'ACTIVE'
       where o.id = e.host_organization_id
         and o.active_status = 'ACTIVE'
     ) then
    return false;
  end if;
  select count(*) into active_count
  from public.registrations r
  where r.event_id = e.id
    and r.registration_status = 'REGISTERED'
    and r.registration_outcome = 'ACTIVE';
  return active_count >= e.capacity;
end;
$$;
revoke all on function public.phase_w1_waitlist_eligible(uuid) from public;
grant execute on function public.phase_w1_waitlist_eligible(uuid) to anon, authenticated, service_role;

create or replace function public.join_event_waitlist(
  p_event_id uuid,
  p_display_name text,
  p_contact text,
  p_invite_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  e public.events%rowtype;
  v_name text := btrim(coalesce(p_display_name, ''));
  v_contact text := btrim(coalesce(p_contact, ''));
  v_normalized text;
  v_count integer;
  v_token text;
  v_id uuid;
begin
  if not public.phase7_registration_legal_allowed() then
    raise exception 'waitlist is not legally available' using errcode = '42501';
  end if;
  if p_event_id is null then
    raise exception 'event unavailable' using errcode = 'P0002';
  end if;
  if char_length(v_name) = 0 or char_length(v_name) > 200 then
    raise exception 'invalid waitlist name' using errcode = '22023';
  end if;
  if char_length(v_contact) = 0 or char_length(v_contact) > 254 then
    raise exception 'invalid waitlist contact' using errcode = '22023';
  end if;
  v_normalized := public.normalize_waitlist_contact(v_contact);
  if char_length(v_normalized) = 0 then
    raise exception 'invalid waitlist contact' using errcode = '22023';
  end if;

  select * into e from public.events where id = p_event_id for update;
  if not found then
    raise exception 'event unavailable' using errcode = 'P0002';
  end if;
  if not public.phase10_event_access_allows(array[p_event_id], p_invite_token) then
    raise exception 'event unavailable' using errcode = '42501';
  end if;
  if not public.phase_w1_waitlist_eligible(p_event_id) then
    raise exception 'waitlist unavailable' using errcode = '42501';
  end if;

  select count(*) into v_count
  from public.event_waitlist_entries w
  where w.event_id = p_event_id
    and w.removed_at is null;
  if v_count >= 5 then
    raise exception 'waitlist unavailable' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.event_waitlist_entries w
    where w.event_id = p_event_id
      and w.normalized_contact = v_normalized
      and w.removed_at is null
  ) then
    raise exception 'already on waitlist' using errcode = '23505';
  end if;

  v_token := encode(gen_random_bytes(32), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
  insert into public.event_waitlist_entries (
    event_id, display_name, contact, normalized_contact, remove_token_hash
  ) values (
    p_event_id, v_name, v_contact, v_normalized, digest(v_token, 'sha256')
  )
  returning id into v_id;

  insert into public.audit_events(
    actor_admin_id, action, entity_type, entity_id, old_values, new_values, reason
  ) values (
    null,
    'EVENT_WAITLIST_JOINED',
    'EVENT_WAITLIST_ENTRY',
    v_id,
    null,
    jsonb_build_object(
      'event_id', p_event_id,
      'normalized_contact', v_normalized,
      'active_count_after', v_count + 1
    ),
    'Public demand waitlist join (DEC-W1)'
  );

  return jsonb_build_object(
    'id', v_id,
    'event_id', p_event_id,
    'remove_token', v_token,
    'active_count', v_count + 1
  );
exception
  when unique_violation then
    raise exception 'already on waitlist' using errcode = '23505';
end;
$$;
revoke all on function public.join_event_waitlist(uuid, text, text, text) from public;
grant execute on function public.join_event_waitlist(uuid, text, text, text) to anon, authenticated;

create or replace function public.remove_event_waitlist_entry(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.event_waitlist_entries%rowtype;
begin
  if p_token is null or char_length(p_token) < 32 then
    raise exception 'waitlist entry unavailable' using errcode = '42501';
  end if;
  select * into v_row
  from public.event_waitlist_entries
  where remove_token_hash = digest(p_token, 'sha256')
  for update;
  if not found then
    raise exception 'waitlist entry unavailable' using errcode = '42501';
  end if;
  if v_row.removed_at is not null then
    return jsonb_build_object('id', v_row.id, 'event_id', v_row.event_id, 'already_removed', true);
  end if;
  update public.event_waitlist_entries
    set removed_at = now()
  where id = v_row.id;

  insert into public.audit_events(
    actor_admin_id, action, entity_type, entity_id, old_values, new_values, reason
  ) values (
    null,
    'EVENT_WAITLIST_REMOVED',
    'EVENT_WAITLIST_ENTRY',
    v_row.id,
    jsonb_build_object('event_id', v_row.event_id, 'removed_at', null),
    jsonb_build_object('event_id', v_row.event_id, 'removed_at', now()),
    'Public demand waitlist self-remove (DEC-W1)'
  );

  return jsonb_build_object('id', v_row.id, 'event_id', v_row.event_id, 'already_removed', false);
end;
$$;
revoke all on function public.remove_event_waitlist_entry(text) from public;
grant execute on function public.remove_event_waitlist_entry(text) to anon, authenticated;

-- Include waitlist_count on public slug projection for join CTA gating.
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
    'waitlist_count', public.event_waitlist_active_count(e.id),
    'series_slug', s.public_slug,
    'occurrences', case when s.id is null then jsonb_build_array(jsonb_build_object(
      'id', e.id, 'name', e.name, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
      'timezone', e.timezone, 'capacity', e.capacity,
      'active_registration_count', (select count(*)::integer from public.registrations r2
        where r2.event_id = e.id and r2.registration_status = 'REGISTERED' and r2.registration_outcome = 'ACTIVE'),
      'waitlist_count', public.event_waitlist_active_count(e.id),
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
      'waitlist_count', public.event_waitlist_active_count(e2.id),
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

-- Waitlist history blocks lean permanent delete (durable operational PII).
create or replace function public.phase3_delete_lean_event(
  p_event_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  actor_id uuid := auth.uid();
  event_row public.events%rowtype;
  canonical_reason text := btrim(coalesce(p_reason, ''));
  blocking_reason text;
begin
  if not public.is_active_system_admin() then
    raise exception 'event unavailable' using errcode = '42501';
  end if;
  if char_length(canonical_reason) = 0 then
    raise exception 'reason is required' using errcode = '22023';
  end if;
  if char_length(canonical_reason) > 500 then
    raise exception 'reason is too long' using errcode = '22023';
  end if;

  select * into event_row
    from public.events
   where id = p_event_id
   for update;
  if not found then
    raise exception 'event unavailable' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.registrations r where r.event_id = p_event_id) then
    blocking_reason := 'registrations';
  elsif exists (
    select 1 from public.registration_group_results g where g.event_id = p_event_id
  ) then
    blocking_reason := 'registration group results';
  elsif exists (
    select 1 from public.event_cancellations c where c.event_id = p_event_id
  ) then
    blocking_reason := 'cancellation history';
  elsif exists (
    select 1
    from public.event_cancellations c
    where c.replacement_event_id = p_event_id
  ) then
    blocking_reason := 'replacement-event references';
  elsif exists (
    select 1 from public.event_cancellation_requests r where r.event_id = p_event_id
  ) then
    blocking_reason := 'cancellation requests';
  elsif exists (
    select 1 from public.over_capacity_overrides o where o.event_id = p_event_id
  ) then
    blocking_reason := 'over-capacity overrides';
  elsif exists (
    select 1 from public.participant_notification_tasks t where t.event_id = p_event_id
  ) then
    blocking_reason := 'notification tasks';
  elsif exists (
    select 1 from public.follow_up_tasks t where t.event_id = p_event_id
  ) then
    blocking_reason := 'follow-up tasks';
  elsif exists (
    select 1 from public.group_chat_reminders g where g.event_id = p_event_id
  ) then
    blocking_reason := 'group chat reminders';
  elsif exists (
    select 1 from public.completed_event_invalidations i where i.event_id = p_event_id
  ) then
    blocking_reason := 'completed-event invalidations';
  elsif exists (
    select 1
    from public.participant_booking_audits a
    where a.source_event_id = p_event_id
       or a.target_event_id = p_event_id
  ) then
    blocking_reason := 'booking audits';
  elsif exists (
    select 1 from public.event_waitlist_entries w where w.event_id = p_event_id
  ) then
    blocking_reason := 'waitlist entries';
  end if;

  if blocking_reason is not null then
    raise exception
      'cannot permanently delete: this event has % — cancel and archive instead, or clear history first',
      blocking_reason
      using errcode = '22023';
  end if;

  insert into public.audit_events(
    actor_admin_id, action, entity_type, entity_id, reason, old_values, new_values
  ) values (
    actor_id,
    'EVENT_DELETED_LEAN',
    'events',
    p_event_id,
    canonical_reason,
    jsonb_build_object(
      'name', event_row.name,
      'status', event_row.status,
      'publication_status', event_row.publication_status,
      'starts_at', event_row.starts_at,
      'archived_at', event_row.archived_at,
      'event_series_id', event_row.event_series_id
    ),
    jsonb_build_object('deleted', true, 'mode', 'lean')
  );

  perform set_config('arakkis.allow_application_delete', 'on', true);

  delete from public.event_eligible_organizations where event_id = p_event_id;
  delete from public.design_assets where event_id = p_event_id;
  delete from public.event_invite_links where event_id = p_event_id;

  delete from public.events where id = p_event_id;
end;
$function$;

revoke all on function public.phase3_delete_lean_event(uuid, text) from public;
grant execute on function public.phase3_delete_lean_event(uuid, text) to authenticated;
