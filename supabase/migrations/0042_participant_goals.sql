-- Participant goals are private profile context, not registration or event data.
alter table public.participants
  add column if not exists goals text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'participants_goals_length'
      and conrelid = 'public.participants'::regclass
  ) then
    alter table public.participants
      add constraint participants_goals_length
      check (goals is null or char_length(goals) <= 500);
  end if;
end $$;

-- Extend the existing authoritative registration transaction. The participant is
-- resolved by the existing legacy function; no client participant identifier is accepted.
create or replace function public.register_selected_events_with_legal(
  p_first_name text,p_last_name text,p_display_phone text,p_normalized_phone text,p_phone_country text,
  p_email text,p_normalized_email text,p_fitness_experience text,p_goals text,p_event_ids uuid[],
  p_participation_acknowledgment_version_id uuid,p_data_use_acknowledgment_version_id uuid,
  p_participation_acknowledged_at timestamptz,p_data_use_acknowledged_at timestamptz,
  p_ip_address inet,p_user_agent text,p_idempotency_key text,
  p_referral_source text,p_referral_source_other_text text,
  p_legal_document_version_ids uuid[],p_legal_package_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_result jsonb;
  v_group_id uuid;
  v_participant_id uuid;
  v_old_goals text;
  v_goals text;
begin
  if p_goals is not null and char_length(p_goals) > 500 then
    raise exception 'goals is too long' using errcode = '22023';
  end if;
  if p_goals ~ '<[^>]*>' then
    raise exception 'goals must be plain text' using errcode = '22023';
  end if;
  v_goals := nullif(btrim(p_goals), '');

  v_result := public.register_selected_events_with_legal(
    p_first_name,p_last_name,p_display_phone,p_normalized_phone,p_phone_country,
    p_email,p_normalized_email,p_fitness_experience,p_event_ids,
    p_participation_acknowledgment_version_id,p_data_use_acknowledgment_version_id,
    p_participation_acknowledged_at,p_data_use_acknowledged_at,p_ip_address,p_user_agent,
    p_idempotency_key,p_referral_source,p_referral_source_other_text,
    p_legal_document_version_ids,p_legal_package_id
  );
  v_group_id := nullif(v_result->>'registration_group_id', '')::uuid;
  select participant_id into v_participant_id
    from public.registration_groups where id = v_group_id;
  select goals into v_old_goals from public.participants where id = v_participant_id for update;
  update public.participants set goals = v_goals where id = v_participant_id;
  if v_old_goals is distinct from v_goals then
    insert into public.audit_events(actor_admin_id, action, entity_type, entity_id, old_values, new_values, request_id)
      values (null, 'PARTICIPANT_GOALS_UPDATED', 'PARTICIPANT', v_participant_id,
        jsonb_build_object('goals', v_old_goals is not null),
        jsonb_build_object('goals', v_goals is not null), p_idempotency_key);
  end if;
  return v_result;
end;
$$;

revoke all on function public.register_selected_events_with_legal(
  text,text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[],uuid
) from public;
grant execute on function public.register_selected_events_with_legal(
  text,text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[],uuid
) to anon, authenticated;

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
    'device_id', v_device.id, 'participant_id', v_participant.id,
    'first_name', v_participant.first_name, 'last_name', v_participant.last_name,
    'display_phone', v_participant.display_phone, 'email', v_participant.email,
    'normalized_phone', v_participant.normalized_phone, 'phone_country', v_participant.phone_country,
    'normalized_email', v_participant.normalized_email,
    'primary_affiliation_organization_id', v_participant.primary_affiliation_organization_id,
    'affiliation_other_text', v_participant.affiliation_other_text,
    'fitness_experience', v_participant.fitness_experience, 'goals', v_participant.goals
  );
end;
$$;

revoke all on function public.phase10_resolve_participant_device_token(text) from public;
grant execute on function public.phase10_resolve_participant_device_token(text) to service_role;
