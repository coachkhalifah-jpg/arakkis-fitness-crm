-- Phase 2: self-service profile reads and transactional invitation acceptance.
-- Auth user creation is performed by the server-only Auth Admin API; this RPC
-- atomically activates the already-created identity and consumes the invitation.

create policy authenticated_read_own_admin_profile on public.admin_profiles
for select to authenticated
using (id = auth.uid());

create policy authenticated_read_own_assignments on public.admin_organization_assignments
for select to authenticated
using (admin_profile_id = auth.uid());

create policy authenticated_read_assigned_organizations on public.organizations
for select to authenticated
using (exists (
  select 1 from public.admin_organization_assignments a
  where a.admin_profile_id = auth.uid()
    and a.organization_id = organizations.id
    and a.revoked_at is null
));

create or replace function public.accept_admin_invitation(
  p_token_hash bytea,
  p_auth_user_id uuid,
  p_email text,
  p_display_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  invitation public.admin_invitations%rowtype;
  auth_email text;
  profile_status public.admin_status;
begin
  if p_token_hash is null or p_auth_user_id is null
     or char_length(btrim(coalesce(p_email, ''))) < 4
     or char_length(btrim(coalesce(p_display_name, ''))) < 1 then
    raise exception 'invalid invitation acceptance' using errcode = '22023';
  end if;

  select u.email into auth_email from auth.users u where u.id = p_auth_user_id;
  if auth_email is null or lower(btrim(auth_email)) <> lower(btrim(p_email)) then
    raise exception 'invalid invitation acceptance' using errcode = '42501';
  end if;

  select * into invitation
  from public.admin_invitations
  where token_hash = p_token_hash
  for update;

  if not found or invitation.status <> 'PENDING'
     or invitation.role <> 'HOST_ADMIN'
     or invitation.token_expires_at <= now()
     or invitation.normalized_email <> lower(btrim(p_email)) then
    raise exception 'invalid invitation acceptance' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.admin_invitation_organizations io
    join public.organizations o on o.id = io.organization_id
    where io.invitation_id = invitation.id and o.active_status = 'ACTIVE'
  ) then
    raise exception 'invalid invitation assignments' using errcode = '23514';
  end if;

  if exists (select 1 from public.admin_profiles p where p.id = p_auth_user_id) then
    raise exception 'administrator identity already linked' using errcode = '23505';
  end if;

  profile_status := 'ACTIVE';
  insert into public.admin_profiles (id, display_name, email, role, status)
  values (p_auth_user_id, btrim(p_display_name), lower(btrim(p_email)), invitation.role, profile_status);

  insert into public.admin_organization_assignments (admin_profile_id, organization_id, created_by_admin_id)
  select p_auth_user_id, io.organization_id, invitation.invited_by_admin_id
  from public.admin_invitation_organizations io
  where io.invitation_id = invitation.id;

  update public.admin_invitations
  set status = 'ACCEPTED', accepted_auth_user_id = p_auth_user_id,
      accepted_admin_profile_id = p_auth_user_id, accepted_at = now()
  where id = invitation.id;

  insert into public.audit_events (actor_admin_id, action, entity_type, entity_id, new_values)
  values (p_auth_user_id, 'ADMIN_INVITATION_ACCEPTED', 'ADMIN_INVITATION', invitation.id,
          jsonb_build_object('admin_profile_id', p_auth_user_id, 'role', invitation.role));

  return jsonb_build_object('accepted', true, 'admin_profile_id', p_auth_user_id);
end;
$$;

revoke all on function public.accept_admin_invitation(bytea, uuid, text, text) from public, anon, authenticated;
grant execute on function public.accept_admin_invitation(bytea, uuid, text, text) to service_role;

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

  insert into public.admin_invitations (invited_email, role, token_hash, token_expires_at, invited_by_admin_id)
  values (lower(btrim(p_invited_email)), 'HOST_ADMIN', p_token_hash, p_token_expires_at, p_invited_by_admin_id)
  returning id into invitation_id;

  insert into public.admin_invitation_organizations (invitation_id, organization_id)
  select invitation_id, requested.id from unnest(p_organization_ids) requested(id);

  insert into public.audit_events (actor_admin_id, action, entity_type, entity_id, new_values)
  values (p_invited_by_admin_id, 'ADMIN_INVITATION_CREATED', 'ADMIN_INVITATION', invitation_id,
          jsonb_build_object('role', 'HOST_ADMIN', 'invited_email', lower(btrim(p_invited_email)), 'organization_count', array_length(p_organization_ids, 1)));
  return invitation_id;
end;
$$;

revoke all on function public.create_admin_invitation(text, bytea, timestamptz, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.create_admin_invitation(text, bytea, timestamptz, uuid, uuid[]) to service_role;

create or replace function public.revoke_admin_invitation(p_invitation_id uuid, p_actor_admin_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (
    select 1 from public.admin_profiles p
    where p.id = p_actor_admin_id and p.role = 'SYSTEM_ADMIN' and p.status = 'ACTIVE'
  ) then
    raise exception 'administrator is not authorized' using errcode = '42501';
  end if;
  update public.admin_invitations
  set status = 'REVOKED', revoked_at = now()
  where id = p_invitation_id and status = 'PENDING';
  if not found then return false; end if;
  insert into public.audit_events (actor_admin_id, action, entity_type, entity_id)
  values (p_actor_admin_id, 'ADMIN_INVITATION_REVOKED', 'ADMIN_INVITATION', p_invitation_id);
  return true;
end;
$$;

revoke all on function public.revoke_admin_invitation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.revoke_admin_invitation(uuid, uuid) to service_role;
