-- Phase 1D / 0011: remove PL/pgSQL variable/column ambiguity from the RPC.
create or replace function public.register_selected_events(
  p_first_name text, p_last_name text, p_display_phone text, p_normalized_phone text, p_phone_country text,
  p_email text, p_normalized_email text, p_primary_affiliation_organization_id uuid, p_affiliation_other_text text,
  p_fitness_experience text, p_event_ids uuid[], p_participation_acknowledgment_version_id uuid,
  p_data_use_acknowledgment_version_id uuid, p_participation_acknowledged_at timestamptz,
  p_data_use_acknowledged_at timestamptz, p_ip_address inet, p_user_agent text, p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_participant_id uuid;
  v_group_id uuid;
  v_token text := encode(gen_random_bytes(32), 'base64');
  v_event_id uuid;
  v_event_row public.events%rowtype;
  v_registration_id uuid;
  v_result jsonb := '[]'::jsonb;
  v_active_count integer;
  v_affiliation_allowed boolean;
begin
  if coalesce(array_length(p_event_ids, 1), 0) = 0 then raise exception 'at least one event is required'; end if;
  if p_user_agent is null or p_ip_address is null then raise exception 'registration evidence is required'; end if;
  if p_idempotency_key is not null then
    select id into v_group_id from public.registration_groups where submission_source = 'PUBLIC' and idempotency_key = p_idempotency_key;
    if v_group_id is not null then
      return jsonb_build_object(
        'registration_group_id', v_group_id,
        'confirmation_token', null,
        'results', coalesce((select jsonb_agg(jsonb_build_object('event_id', r.event_id, 'registration_id', r.id, 'success', true)) from public.registrations r where r.registration_group_id = v_group_id), '[]'::jsonb)
      );
    end if;
  end if;
  if not exists (select 1 from public.acknowledgment_versions v where v.id = p_participation_acknowledgment_version_id and v.type = 'PARTICIPATION_RISK' and v.legal_status in ('APPROVED', 'PROVISIONAL')) then raise exception 'invalid Participation acknowledgment version'; end if;
  if not exists (select 1 from public.acknowledgment_versions v where v.id = p_data_use_acknowledgment_version_id and v.type = 'DATA_USE' and v.legal_status in ('APPROVED', 'PROVISIONAL')) then raise exception 'invalid Data Use acknowledgment version'; end if;

  select p.id into v_participant_id from public.participants p
    where p.normalized_phone = p_normalized_phone and p.normalized_first_name = lower(btrim(p_first_name)) and p.normalized_last_name = lower(btrim(p_last_name))
    order by p.created_at limit 1 for update;
  if v_participant_id is null then
    insert into public.participants (first_name, last_name, normalized_first_name, normalized_last_name, display_phone, normalized_phone, phone_country, email, normalized_email, primary_affiliation_organization_id, affiliation_other_text, fitness_experience)
    values (p_first_name, p_last_name, lower(btrim(p_first_name)), lower(btrim(p_last_name)), p_display_phone, p_normalized_phone, p_phone_country, p_email, p_normalized_email, p_primary_affiliation_organization_id, p_affiliation_other_text, p_fitness_experience)
    returning id into v_participant_id;
  end if;

  insert into public.registration_groups (participant_id, submission_source, participation_acknowledgment_version_id, participation_acknowledged_at, data_use_acknowledgment_version_id, data_use_acknowledged_at, idempotency_key)
  values (v_participant_id, 'PUBLIC', p_participation_acknowledgment_version_id, p_participation_acknowledged_at, p_data_use_acknowledgment_version_id, p_data_use_acknowledged_at, p_idempotency_key)
  returning id into v_group_id;
  insert into public.acknowledgment_acceptances (participant_id, registration_group_id, acknowledgment_version_id, accepted_at, acceptance_method, ip_address, user_agent)
  values (v_participant_id, v_group_id, p_participation_acknowledgment_version_id, p_participation_acknowledged_at, 'PUBLIC_REGISTRATION', p_ip_address, p_user_agent),
         (v_participant_id, v_group_id, p_data_use_acknowledgment_version_id, p_data_use_acknowledged_at, 'PUBLIC_REGISTRATION', p_ip_address, p_user_agent);

  foreach v_event_id in array p_event_ids loop
    select * into v_event_row from public.events e where e.id = v_event_id for update;
    if not found then v_result := v_result || jsonb_build_object('event_id', v_event_id, 'success', false, 'reason', 'NOT_FOUND'); continue; end if;
    if v_event_row.status <> 'OPEN' or v_event_row.registration_deadline < now() or v_event_row.starts_at <= now() then v_result := v_result || jsonb_build_object('event_id', v_event_id, 'success', false, 'reason', 'CLOSED'); continue; end if;
    if v_event_row.visibility = 'AFFILIATION_RESTRICTED' then
      select exists (select 1 from public.event_eligible_organizations x where x.event_id = v_event_row.id and x.organization_id = p_primary_affiliation_organization_id) into v_affiliation_allowed;
      if not v_affiliation_allowed then v_result := v_result || jsonb_build_object('event_id', v_event_id, 'success', false, 'reason', 'INELIGIBLE'); continue; end if;
    end if;
    if exists (select 1 from public.registrations r where r.participant_id = v_participant_id and r.event_id = v_event_id and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE') then v_result := v_result || jsonb_build_object('event_id', v_event_id, 'success', false, 'reason', 'ALREADY_REGISTERED'); continue; end if;
    select count(*) into v_active_count from public.registrations r where r.event_id = v_event_id and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE';
    if v_active_count >= v_event_row.capacity then v_result := v_result || jsonb_build_object('event_id', v_event_id, 'success', false, 'reason', 'FULL'); continue; end if;
    insert into public.registrations (registration_group_id, participant_id, event_id, affiliation_organization_id_at_registration, affiliation_other_text_at_registration)
    values (v_group_id, v_participant_id, v_event_id, p_primary_affiliation_organization_id, p_affiliation_other_text) returning id into v_registration_id;
    v_result := v_result || jsonb_build_object('event_id', v_event_id, 'registration_id', v_registration_id, 'success', true);
  end loop;

  insert into public.confirmation_tokens (registration_group_id, token_hash, expires_at) values (v_group_id, digest(v_token, 'sha256'), now() + interval '24 hours');
  return jsonb_build_object('registration_group_id', v_group_id, 'confirmation_token', v_token, 'results', v_result);
end;
$$;
