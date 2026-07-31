-- Phase 10: optional remembered-browser convenience for participant booking.
-- Raw tokens are generated and returned only to the server application. The database
-- stores a SHA-256 digest and never exposes device credentials through table reads.
create table public.participant_remembered_devices (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete restrict,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  replaced_by_device_id uuid references public.participant_remembered_devices(id) on delete restrict,
  label text not null default 'This device',
  constraint participant_remembered_devices_expiry check (expires_at > created_at),
  constraint participant_remembered_devices_label check (char_length(btrim(label)) between 1 and 80)
);

create index participant_remembered_devices_participant_idx
  on public.participant_remembered_devices (participant_id, expires_at)
  where revoked_at is null;

alter table public.participant_remembered_devices enable row level security;
revoke all on public.participant_remembered_devices from anon, authenticated;

create or replace function public.phase10_issue_participant_device_token(p_confirmation_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_group_id uuid;
  v_participant_id uuid;
  v_first_name text;
  v_raw text;
  v_device_id uuid;
begin
  if p_confirmation_token is null or char_length(p_confirmation_token) < 32 then
    raise exception 'invalid confirmation';
  end if;
  select ct.registration_group_id, g.participant_id, p.first_name
    into v_group_id, v_participant_id, v_first_name
  from public.confirmation_tokens ct
  join public.registration_groups g on g.id = ct.registration_group_id
  join public.participants p on p.id = g.participant_id and p.status = 'ACTIVE'
  where ct.token_hash = digest(p_confirmation_token, 'sha256')
    and ct.revoked_at is null and ct.expires_at > now();
  if v_group_id is null then raise exception 'invalid confirmation'; end if;

  v_raw := encode(gen_random_bytes(32), 'hex');
  insert into public.participant_remembered_devices(participant_id, token_hash, expires_at)
    values (v_participant_id, digest(v_raw, 'sha256'), now() + interval '180 days')
    returning id into v_device_id;
  return jsonb_build_object('device_id', v_device_id, 'token', v_raw, 'first_name', v_first_name);
end;
$$;

create or replace function public.phase10_resolve_participant_device_token(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_device public.participant_remembered_devices; v_participant public.participants;
begin
  if p_token is null or char_length(p_token) < 32 then return null; end if;
  select * into v_device from public.participant_remembered_devices
  where token_hash = digest(p_token, 'sha256') and revoked_at is null and expires_at > now()
  for update;
  if not found then return null; end if;
  select * into v_participant from public.participants where id = v_device.participant_id and status = 'ACTIVE';
  if not found then return null; end if;
  update public.participant_remembered_devices set last_used_at = now() where id = v_device.id;
  return jsonb_build_object(
    'device_id', v_device.id,
    'participant_id', v_participant.id,
    'first_name', v_participant.first_name,
    'last_name', v_participant.last_name,
    'display_phone', v_participant.display_phone,
    'email', v_participant.email,
    'normalized_phone', v_participant.normalized_phone,
    'phone_country', v_participant.phone_country,
    'normalized_email', v_participant.normalized_email,
    'primary_affiliation_organization_id', v_participant.primary_affiliation_organization_id,
    'affiliation_other_text', v_participant.affiliation_other_text,
    'fitness_experience', v_participant.fitness_experience
  );
end;
$$;

create or replace function public.phase10_revoke_participant_device(p_token text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.participant_remembered_devices
  set revoked_at = coalesce(revoked_at, now())
  where token_hash = digest(coalesce(p_token, ''), 'sha256') and revoked_at is null;
  return found;
end;
$$;

revoke all on function public.phase10_issue_participant_device_token(text) from public;
revoke all on function public.phase10_resolve_participant_device_token(text) from public;
revoke all on function public.phase10_revoke_participant_device(text) from public;
grant execute on function public.phase10_issue_participant_device_token(text) to service_role;
grant execute on function public.phase10_resolve_participant_device_token(text) to service_role;
grant execute on function public.phase10_revoke_participant_device(text) to service_role;
