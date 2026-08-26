-- Prevent more than one active pending invitation for a normalized recipient
-- and Organization, including concurrent creation attempts.

alter table public.admin_invitation_organizations
  add column normalized_email text,
  add column is_pending boolean not null default false;

create or replace function public.sync_admin_invitation_organization_key()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.admin_invitations%rowtype;
begin
  select * into invitation
  from public.admin_invitations
  where id = new.invitation_id;

  if not found then
    raise exception 'invalid invitation assignment' using errcode = '23503';
  end if;

  new.normalized_email := invitation.normalized_email;
  new.is_pending := invitation.status = 'PENDING'
    and invitation.token_expires_at > now();
  return new;
end;
$$;

create or replace function public.sync_admin_invitation_organization_keys()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.admin_invitation_organizations
  set normalized_email = new.normalized_email,
      is_pending = new.status = 'PENDING' and new.token_expires_at > now()
  where invitation_id = new.id;
  return new;
end;
$$;

drop trigger if exists admin_invitation_organization_key_before_insert
  on public.admin_invitation_organizations;
create trigger admin_invitation_organization_key_before_insert
before insert on public.admin_invitation_organizations
for each row execute function public.sync_admin_invitation_organization_key();

drop trigger if exists admin_invitation_organization_key_after_update
  on public.admin_invitations;
create trigger admin_invitation_organization_key_after_update
after update of invited_email, status, token_expires_at on public.admin_invitations
for each row execute function public.sync_admin_invitation_organization_keys();

update public.admin_invitation_organizations io
set normalized_email = ai.normalized_email,
    is_pending = ai.status = 'PENDING' and ai.token_expires_at > now()
from public.admin_invitations ai
where ai.id = io.invitation_id;

update public.admin_invitations
set status = 'EXPIRED'
where status = 'PENDING' and token_expires_at <= now();

alter table public.admin_invitation_organizations
  alter column normalized_email set not null;

create unique index admin_invitation_pending_org_uq
on public.admin_invitation_organizations (normalized_email, organization_id)
where is_pending;

create or replace function public.create_admin_invitation(
  p_invited_email text,
  p_token_hash bytea,
  p_token_expires_at timestamptz,
  p_invited_by_admin_id uuid,
  p_organization_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  invitation_id uuid;
  existing_invitation_id uuid;
  normalized_recipient text := lower(btrim(p_invited_email));
begin
  if not exists (
    select 1 from public.admin_profiles p
    where p.id = p_invited_by_admin_id and p.role = 'SYSTEM_ADMIN' and p.status = 'ACTIVE'
  ) then
    raise exception 'administrator is not authorized' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_invited_email, ''))) < 4
     or p_token_hash is null or p_token_expires_at <= now()
     or coalesce(array_length(p_organization_ids, 1), 0) = 0 then
    raise exception 'invalid invitation' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_organization_ids) requested(id)
    left join public.organizations o on o.id = requested.id
    where o.id is null or o.active_status <> 'ACTIVE'
  ) then
    raise exception 'invalid invitation assignments' using errcode = '22023';
  end if;

  -- Expired invitations are terminal and must not reserve an Organization.
  update public.admin_invitations ai
  set status = 'EXPIRED'
  where ai.status = 'PENDING'
    and ai.token_expires_at <= now()
    and ai.normalized_email = normalized_recipient
    and exists (
      select 1 from public.admin_invitation_organizations io
      where io.invitation_id = ai.id
        and io.organization_id = any(p_organization_ids)
    );

  insert into public.admin_invitations (invited_email, role, token_hash, token_expires_at, invited_by_admin_id)
  values (normalized_recipient, 'HOST_ADMIN', p_token_hash, p_token_expires_at, p_invited_by_admin_id)
  returning id into invitation_id;

  begin
    insert into public.admin_invitation_organizations (invitation_id, organization_id)
    select invitation_id, requested.id
    from unnest(p_organization_ids) requested(id)
    group by requested.id;
  exception when unique_violation then
    -- The unique index serializes concurrent attempts. The losing request
    -- rotates the one existing pending invitation, invalidating its old link.
    update public.admin_invitations
    set status = 'REPLACED',
        token_hash = decode(
          md5(invitation_id::text || clock_timestamp()::text || random()::text)
          || md5(random()::text),
          'hex'
        )
    where id = invitation_id;

    select ai.id into existing_invitation_id
    from public.admin_invitations ai
    where ai.status = 'PENDING'
      and ai.token_expires_at > now()
      and ai.normalized_email = normalized_recipient
      and exists (
        select 1 from public.admin_invitation_organizations io
        where io.invitation_id = ai.id
          and io.organization_id = any(p_organization_ids)
          and io.is_pending
      )
    order by ai.issued_at desc
    limit 1
    for update;

    if existing_invitation_id is null then
      raise exception 'pending invitation conflict could not be resolved';
    end if;

    update public.admin_invitations
    set token_hash = p_token_hash,
        token_expires_at = p_token_expires_at,
        issued_at = now(),
        status = 'PENDING',
        revoked_at = null
    where id = existing_invitation_id;

    insert into public.audit_events (actor_admin_id, action, entity_type, entity_id, new_values)
    values (p_invited_by_admin_id, 'ADMIN_INVITATION_REGENERATED', 'ADMIN_INVITATION', existing_invitation_id,
            jsonb_build_object('reason', 'duplicate_pending_creation', 'expires_at', p_token_expires_at));
    return existing_invitation_id;
  end;

  insert into public.audit_events (actor_admin_id, action, entity_type, entity_id, new_values)
  values (p_invited_by_admin_id, 'ADMIN_INVITATION_CREATED', 'ADMIN_INVITATION', invitation_id,
          jsonb_build_object('role', 'HOST_ADMIN', 'invited_email', normalized_recipient, 'organization_count', array_length(p_organization_ids, 1)));
  return invitation_id;
end;
$$;

revoke all on function public.create_admin_invitation(text, bytea, timestamptz, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.create_admin_invitation(text, bytea, timestamptz, uuid, uuid[]) to service_role;
