-- Qualify the participant column in the scoped management-token join.
create or replace function public.phase10_resolve_booking_access(
  p_token text,
  p_registration_id uuid
)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_participant_id uuid;
  v_group_id uuid;
begin
  if p_token is null or char_length(p_token) < 32 or p_registration_id is null then
    return null;
  end if;

  select d.participant_id into v_participant_id
  from public.participant_remembered_devices d
  where d.token_hash = digest(p_token, 'sha256')
    and d.revoked_at is null
    and d.expires_at > now();
  if v_participant_id is not null then
    update public.participant_remembered_devices
       set last_used_at = now()
     where token_hash = digest(p_token, 'sha256');
    return v_participant_id;
  end if;

  select t.participant_id into v_participant_id
  from public.participant_booking_management_tokens t
  join public.registrations r on r.participant_id = t.participant_id
  where t.token_hash = digest(p_token, 'sha256')
    and t.revoked_at is null
    and t.consumed_at is null
    and t.expires_at > now()
    and r.id = p_registration_id;
  if v_participant_id is not null then
    update public.participant_booking_management_tokens
       set consumed_at = now()
     where token_hash = digest(p_token, 'sha256');
    return v_participant_id;
  end if;

  select ct.registration_group_id into v_group_id
  from public.confirmation_tokens ct
  join public.registration_group_results gr
    on gr.registration_group_id = ct.registration_group_id
   and gr.registration_id = p_registration_id
   and gr.success
  where ct.token_hash = digest(p_token, 'sha256')
    and ct.revoked_at is null
    and ct.expires_at > now();
  if v_group_id is null then return null; end if;

  select rg.participant_id into v_participant_id
  from public.registration_groups rg
  where rg.id = v_group_id;
  if v_participant_id is null then return null; end if;

  update public.confirmation_tokens
     set last_accessed_at = now(), access_count = access_count + 1
   where token_hash = digest(p_token, 'sha256');
  return v_participant_id;
end;
$$;

revoke all on function public.phase10_resolve_booking_access(text, uuid) from public;
