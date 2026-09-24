-- DEC-059: System Admin manual participant manage/recovery links.
-- Opaque high-entropy tokens; SHA-256 hash only at rest. Single PENDING link per
-- participant. Consume is single-use and issues a remember-device token so the
-- existing manage RPCs apply. No automated messaging.

create type public.participant_manage_recovery_status as enum (
  'PENDING',
  'CONSUMED',
  'REVOKED',
  'REPLACED'
);

create table public.participant_manage_recovery_links (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete restrict,
  token_hash bytea not null unique,
  status public.participant_manage_recovery_status not null default 'PENDING',
  issued_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  replaced_by_link_id uuid references public.participant_manage_recovery_links(id) on delete restrict,
  consumed_device_id uuid references public.participant_remembered_devices(id) on delete restrict,
  constraint participant_manage_recovery_expiry check (expires_at > issued_at)
);

create unique index participant_manage_recovery_one_pending_idx
  on public.participant_manage_recovery_links (participant_id)
  where status = 'PENDING';

create index participant_manage_recovery_participant_idx
  on public.participant_manage_recovery_links (participant_id, issued_at desc);

create index participant_manage_recovery_status_expiry_idx
  on public.participant_manage_recovery_links (status, expires_at);

alter table public.participant_manage_recovery_links enable row level security;

create policy system_admin_select_participant_manage_recovery_links
  on public.participant_manage_recovery_links
  for select
  to authenticated
  using (public.is_active_system_admin());

grant select on public.participant_manage_recovery_links to authenticated;
revoke insert, update, delete on public.participant_manage_recovery_links from authenticated;
revoke all on public.participant_manage_recovery_links from anon;

create or replace function public.issue_participant_manage_recovery_link(
  p_participant_id uuid,
  p_token_hash bytea,
  p_token_expires_at timestamptz,
  p_actor_admin_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  previous_id uuid;
  link_id uuid;
  action_name text;
begin
  if not exists (
    select 1 from public.admin_profiles p
    where p.id = p_actor_admin_id and p.role = 'SYSTEM_ADMIN' and p.status = 'ACTIVE'
  ) then
    raise exception 'administrator is not authorized' using errcode = '42501';
  end if;

  if p_participant_id is null or p_token_hash is null or p_token_expires_at is null
     or p_token_expires_at <= now() then
    raise exception 'invalid recovery link' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.participants
    where id = p_participant_id and status = 'ACTIVE'
  ) then
    raise exception 'participant is not available' using errcode = '22023';
  end if;

  select id into previous_id
  from public.participant_manage_recovery_links
  where participant_id = p_participant_id and status = 'PENDING'
  for update;

  -- Clear PENDING before insert so the one-pending unique index stays satisfied.
  if previous_id is not null then
    update public.participant_manage_recovery_links
    set status = 'REPLACED',
        revoked_at = coalesce(revoked_at, now())
    where id = previous_id;
    action_name := 'PARTICIPANT_MANAGE_RECOVERY_REGENERATED';
  else
    action_name := 'PARTICIPANT_MANAGE_RECOVERY_ISSUED';
  end if;

  insert into public.participant_manage_recovery_links (
    participant_id, token_hash, issued_by_admin_id, expires_at
  ) values (
    p_participant_id, p_token_hash, p_actor_admin_id, p_token_expires_at
  ) returning id into link_id;

  if previous_id is not null then
    update public.participant_manage_recovery_links
    set replaced_by_link_id = link_id
    where id = previous_id;
  end if;

  insert into public.audit_events (
    actor_admin_id, action, entity_type, entity_id, new_values
  ) values (
    p_actor_admin_id,
    action_name,
    'PARTICIPANT_MANAGE_RECOVERY_LINK',
    link_id,
    jsonb_build_object(
      'participant_id', p_participant_id,
      'expires_at', p_token_expires_at,
      'replaced_link_id', previous_id
    )
  );

  return link_id;
end;
$$;

create or replace function public.revoke_participant_manage_recovery_link(
  p_participant_id uuid,
  p_actor_admin_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  link_id uuid;
begin
  if not exists (
    select 1 from public.admin_profiles p
    where p.id = p_actor_admin_id and p.role = 'SYSTEM_ADMIN' and p.status = 'ACTIVE'
  ) then
    raise exception 'administrator is not authorized' using errcode = '42501';
  end if;

  update public.participant_manage_recovery_links
  set status = 'REVOKED', revoked_at = now()
  where participant_id = p_participant_id
    and status = 'PENDING'
  returning id into link_id;

  if link_id is null then
    return false;
  end if;

  insert into public.audit_events (
    actor_admin_id, action, entity_type, entity_id, new_values
  ) values (
    p_actor_admin_id,
    'PARTICIPANT_MANAGE_RECOVERY_REVOKED',
    'PARTICIPANT_MANAGE_RECOVERY_LINK',
    link_id,
    jsonb_build_object('participant_id', p_participant_id)
  );

  return true;
end;
$$;

-- Single-use consume: validates the recovery bearer, marks the link consumed, and
-- issues a remember-device token so existing manage paths apply on that browser.
create or replace function public.consume_participant_manage_recovery_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_link public.participant_manage_recovery_links%rowtype;
  v_first_name text;
  v_raw text;
  v_device_id uuid;
begin
  if p_token is null or char_length(p_token) < 32 then
    return null;
  end if;

  select * into v_link
  from public.participant_manage_recovery_links
  where token_hash = digest(p_token, 'sha256')
    and status = 'PENDING'
    and expires_at > now()
  for update;

  if not found then
    return null;
  end if;

  select first_name into v_first_name
  from public.participants
  where id = v_link.participant_id and status = 'ACTIVE';

  if v_first_name is null then
    return null;
  end if;

  v_raw := encode(gen_random_bytes(32), 'hex');
  insert into public.participant_remembered_devices (participant_id, token_hash, expires_at)
  values (v_link.participant_id, digest(v_raw, 'sha256'), now() + interval '180 days')
  returning id into v_device_id;

  update public.participant_manage_recovery_links
  set status = 'CONSUMED',
      consumed_at = now(),
      consumed_device_id = v_device_id
  where id = v_link.id;

  insert into public.audit_events (
    actor_admin_id, action, entity_type, entity_id, new_values
  ) values (
    null,
    'PARTICIPANT_MANAGE_RECOVERY_CONSUMED',
    'PARTICIPANT_MANAGE_RECOVERY_LINK',
    v_link.id,
    jsonb_build_object(
      'participant_id', v_link.participant_id,
      'device_id', v_device_id
    )
  );

  return jsonb_build_object(
    'link_id', v_link.id,
    'participant_id', v_link.participant_id,
    'device_id', v_device_id,
    'token', v_raw,
    'first_name', v_first_name
  );
end;
$$;

revoke all on function public.issue_participant_manage_recovery_link(uuid, bytea, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.issue_participant_manage_recovery_link(uuid, bytea, timestamptz, uuid)
  to service_role;

revoke all on function public.revoke_participant_manage_recovery_link(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.revoke_participant_manage_recovery_link(uuid, uuid)
  to service_role;

revoke all on function public.consume_participant_manage_recovery_link(text)
  from public;
grant execute on function public.consume_participant_manage_recovery_link(text)
  to anon, authenticated, service_role;
