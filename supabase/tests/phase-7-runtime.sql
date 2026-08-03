-- Phase 7 invitation lifecycle and production legal-gate assertions.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
values ('71000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'phase7@example.test', now(), now(), now());
insert into public.admin_profiles (id, display_name, email, role, status)
values ('71000000-0000-0000-0000-000000000001', 'Phase 7 System', 'phase7@example.test', 'SYSTEM_ADMIN', 'ACTIVE');
insert into public.organizations (id, name)
values ('72000000-0000-0000-0000-000000000001', 'Phase 7 Organization');
insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
values ('71000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'phase7-accepted@example.test', now(), now(), now());

do $$
declare invitation_id uuid; old_hash bytea; new_hash bytea;
begin
  invitation_id := public.create_admin_invitation(
    'phase7-invite@example.test', decode(repeat('a', 64), 'hex'), now() + interval '72 hours',
    '71000000-0000-0000-0000-000000000001', array['72000000-0000-0000-0000-000000000001'::uuid]
  );
  select token_hash into old_hash from public.admin_invitations where id = invitation_id;
  if not public.regenerate_admin_invitation(invitation_id, decode(repeat('b', 64), 'hex'), now() + interval '72 hours', '71000000-0000-0000-0000-000000000001') then
    raise exception 'invitation regeneration failed';
  end if;
  select token_hash into new_hash from public.admin_invitations where id = invitation_id;
  if old_hash = new_hash or new_hash <> decode(repeat('b', 64), 'hex') then raise exception 'old invitation token remained active'; end if;
  if not public.revoke_admin_invitation(invitation_id, '71000000-0000-0000-0000-000000000001') then raise exception 'invitation revocation failed'; end if;
  if (select status from public.admin_invitations where id = invitation_id) <> 'REVOKED' then raise exception 'revoked state was not persisted'; end if;
  if not exists (select 1 from public.audit_events where entity_id = invitation_id and action = 'ADMIN_INVITATION_REGENERATED') then raise exception 'regeneration audit missing'; end if;
end $$;

-- Deterministic replay proof for the row-locked acceptance boundary: the first
-- acceptance consumes the invitation and every retry loses to the persisted
-- terminal state. This is the observable result required from concurrent callers.
do $$
declare invitation_id uuid; result jsonb;
begin
  invitation_id := public.create_admin_invitation(
    'phase7-accepted@example.test', decode(repeat('c', 64), 'hex'), now() + interval '72 hours',
    '71000000-0000-0000-0000-000000000001', array['72000000-0000-0000-0000-000000000001'::uuid]
  );
  result := public.accept_admin_invitation(
    decode(repeat('c', 64), 'hex'), '71000000-0000-0000-0000-000000000002',
    'phase7-accepted@example.test', 'Accepted Phase 7 Admin'
  );
  if result->>'accepted' <> 'true' then raise exception 'first invitation acceptance failed'; end if;
  if (select status from public.admin_invitations where id = invitation_id) <> 'ACCEPTED' then
    raise exception 'accepted invitation did not reach terminal state';
  end if;
  begin
    perform public.accept_admin_invitation(
      decode(repeat('c', 64), 'hex'), '71000000-0000-0000-0000-000000000002',
      'phase7-accepted@example.test', 'Accepted Phase 7 Admin'
    );
    raise exception 'invitation replay unexpectedly succeeded';
  exception when others then
    if sqlstate <> '42501' or sqlerrm <> 'invalid invitation acceptance' then raise; end if;
  end;
  if public.regenerate_admin_invitation(invitation_id, decode(repeat('d', 64), 'hex'), now() + interval '72 hours', '71000000-0000-0000-0000-000000000001') then
    raise exception 'accepted invitation was regenerated';
  end if;
  if public.revoke_admin_invitation(invitation_id, '71000000-0000-0000-0000-000000000001') then
    raise exception 'accepted invitation was revoked';
  end if;
end $$;

do $$
begin
  if pg_get_functiondef('public.manage_participant_booking(text,text,uuid,uuid)'::regprocedure)
      like '%v_target_venue%' then
    raise exception 'participant booking RPC still contains the removed unused variable';
  end if;
  if not has_function_privilege('service_role', 'public.manage_participant_booking(text,text,uuid,uuid)', 'EXECUTE') then
    raise exception 'service role lost participant booking RPC execution privilege';
  end if;
end $$;

select set_config('app.environment', 'production', true);
do $$
begin
  if public.phase7_registration_legal_allowed() then raise exception 'production legal gate unexpectedly allowed registration'; end if;
  begin
    perform public.register_selected_events(
      null::text, null::text, null::text, null::text, null::text, null::text, null::text,
      null::uuid, null::text, null::text, null::uuid[], null::uuid, null::uuid,
      null::timestamptz, null::timestamptz, null::inet, null::text, null::text
    );
    raise exception 'production registration RPC bypassed legal gate';
  exception when others then
    if sqlstate <> '42501' or sqlerrm <> 'registration is not legally available' then raise; end if;
  end;
end $$;
rollback;
reset all;
