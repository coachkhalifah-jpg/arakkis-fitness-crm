-- Issue a fresh short-lived confirmation token only after validating the remembered device
-- and selected registration belong to the same participant.
create or replace function public.phase10_issue_participant_confirmation_token(
  p_token text,
  p_registration_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_participant_id uuid;
  v_group_id uuid;
  v_raw text;
begin
  select d.participant_id into v_participant_id
  from public.participant_remembered_devices d
  where d.token_hash = digest(coalesce(p_token, ''), 'sha256')
    and d.revoked_at is null and d.expires_at > now();
  if v_participant_id is null then raise exception 'booking access is invalid' using errcode = '42501'; end if;

  select r.registration_group_id into v_group_id
  from public.registrations r
  join public.registration_group_results gr
    on gr.registration_group_id = r.registration_group_id and gr.success
  where r.id = p_registration_id and r.participant_id = v_participant_id;
  if v_group_id is null then raise exception 'booking was not found' using errcode = '42501'; end if;

  update public.confirmation_tokens
  set revoked_at = coalesce(revoked_at, now())
  where registration_group_id = v_group_id and revoked_at is null;

  v_raw := regexp_replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=+$', '');
  insert into public.confirmation_tokens (registration_group_id, token_hash, expires_at)
  values (v_group_id, digest(v_raw, 'sha256'), now() + interval '24 hours');
  return jsonb_build_object('token', v_raw);
end;
$$;

revoke all on function public.phase10_issue_participant_confirmation_token(text, uuid) from public;
grant execute on function public.phase10_issue_participant_confirmation_token(text, uuid) to service_role;
