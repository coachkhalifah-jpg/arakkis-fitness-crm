-- Phase 2 authentication/invitation database tests.
-- Run as local Postgres superuser against a disposable local database.

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
values
  ('11000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'inviter@example.test', now(), now(), now()),
  ('11000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'invitee@example.test', now(), now(), now());

insert into public.admin_profiles (id, display_name, email, role, status)
values ('11000000-0000-0000-0000-000000000001', 'Local System Admin', 'inviter@example.test', 'SYSTEM_ADMIN', 'ACTIVE');

insert into public.organizations (id, name)
values ('12000000-0000-0000-0000-000000000001', 'Invitation Organization');

insert into public.admin_invitations (id, invited_email, role, token_hash, token_expires_at, invited_by_admin_id)
values (
  '13000000-0000-0000-0000-000000000001', 'invitee@example.test', 'HOST_ADMIN',
  decode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'hex'), now() + interval '72 hours',
  '11000000-0000-0000-0000-000000000001'
);

insert into public.admin_invitation_organizations (invitation_id, organization_id)
values ('13000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001');

do $$
declare created_invitation uuid;
begin
  created_invitation := public.create_admin_invitation(
    'revoked@example.test', decode('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'hex'),
    now() + interval '72 hours', '11000000-0000-0000-0000-000000000001',
    array['12000000-0000-0000-0000-000000000001'::uuid]
  );
  if not public.revoke_admin_invitation(created_invitation, '11000000-0000-0000-0000-000000000001') then
    raise exception 'pending invitation was not revoked';
  end if;
  if not exists (select 1 from public.admin_invitations where id = created_invitation and status = 'REVOKED') then
    raise exception 'revoked invitation status was not persisted';
  end if;
end;
$$;

select public.accept_admin_invitation(
  decode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'hex'),
  '11000000-0000-0000-0000-000000000002', 'INVITEE@example.test', 'Invited Host'
);

do $$
begin
  if not exists (select 1 from public.admin_profiles where id = '11000000-0000-0000-0000-000000000002' and role = 'HOST_ADMIN' and status = 'ACTIVE') then
    raise exception 'invited profile was not activated';
  end if;
  if not exists (select 1 from public.admin_organization_assignments where admin_profile_id = '11000000-0000-0000-0000-000000000002' and organization_id = '12000000-0000-0000-0000-000000000001' and revoked_at is null) then
    raise exception 'invitation assignment was not copied';
  end if;
  if not exists (select 1 from public.admin_invitations where id = '13000000-0000-0000-0000-000000000001' and status = 'ACCEPTED' and accepted_auth_user_id = '11000000-0000-0000-0000-000000000002') then
    raise exception 'invitation was not consumed';
  end if;
  if not exists (select 1 from public.audit_events where action = 'ADMIN_INVITATION_ACCEPTED' and entity_id = '13000000-0000-0000-0000-000000000001') then
    raise exception 'invitation acceptance was not audited';
  end if;
end;
$$;

do $$
begin
  begin
    perform public.accept_admin_invitation(
      decode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'hex'),
      '11000000-0000-0000-0000-000000000002', 'invitee@example.test', 'Replay'
    );
    raise exception 'consumed invitation was accepted twice';
  exception when others then
    if sqlerrm not like 'invalid invitation%' and sqlerrm not like 'administrator identity%' then raise; end if;
  end;
end;
$$;

do $$
begin
  if has_function_privilege('anon', 'public.accept_admin_invitation(bytea,uuid,text,text)', 'EXECUTE') then
    raise exception 'anonymous invitation acceptance privilege leaked';
  end if;
  if has_function_privilege('authenticated', 'public.accept_admin_invitation(bytea,uuid,text,text)', 'EXECUTE') then
    raise exception 'authenticated invitation acceptance privilege leaked';
  end if;
end;
$$;

rollback;
reset all;
