-- Preserve the authoritative Data Use acknowledgment when the consolidated
-- legal package delegates registration to the legacy evidence writer.
create or replace function public.register_selected_events_with_legal(
  p_first_name text,p_last_name text,p_display_phone text,p_normalized_phone text,p_phone_country text,
  p_email text,p_normalized_email text,p_fitness_experience text,p_goals text,p_event_ids uuid[],
  p_participation_acknowledgment_version_id uuid,p_data_use_acknowledgment_version_id uuid,
  p_participation_acknowledged_at timestamptz,p_data_use_acknowledged_at timestamptz,
  p_ip_address inet,p_user_agent text,p_idempotency_key text,
  p_referral_source text,p_referral_source_other_text text,
  p_legal_document_version_ids uuid[],
  p_legal_package_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_result jsonb; v_group_id uuid; v_participant_id uuid; v_package_version text;
  v_package_effective_at timestamptz; v_package_content_hash bytea; v_components jsonb;
  v_participation uuid; v_component_ids uuid[];
begin
  if not public.legal_package_is_valid(p_legal_package_id) then
    raise exception 'current legal package is unavailable' using errcode = '22023';
  end if;
  if p_data_use_acknowledgment_version_id is null then
    raise exception 'current data-use acknowledgment is unavailable' using errcode = '22023';
  end if;
  select p.package_version,p.effective_at,p.content_hash,
    (select jsonb_agg(jsonb_build_object('type',c.document_type,'id',v.id,'version',v.version,'content_hash',encode(v.content_hash,'hex')) order by c.document_type)
       from public.legal_package_components c join public.acknowledgment_versions v on v.id=c.acknowledgment_version_id where c.legal_package_id=p.id),
    (select c.acknowledgment_version_id from public.legal_package_components c where c.legal_package_id=p.id and c.document_type='PARTICIPATION_RISK')
  into v_package_version,v_package_effective_at,v_package_content_hash,v_components,v_participation
  from public.legal_packages p where p.id=p_legal_package_id;
  select array_agg(c.acknowledgment_version_id order by c.document_type) into v_component_ids
    from public.legal_package_components c where c.legal_package_id=p_legal_package_id;
  if p_participation_acknowledgment_version_id is distinct from v_participation
     or p_legal_document_version_ids is distinct from v_component_ids then
    raise exception 'legal package components do not match the active package' using errcode = '22023';
  end if;
  -- The legacy transaction retains the supplied Data Use acknowledgment as its
  -- compatibility field. Package evidence separately records Privacy Policy.
  v_result := public.register_selected_events_with_legal_legacy(
    p_first_name,p_last_name,p_display_phone,p_normalized_phone,p_phone_country,
    p_email,p_normalized_email,p_fitness_experience,p_event_ids,
    v_participation,p_data_use_acknowledgment_version_id,
    p_participation_acknowledged_at,p_data_use_acknowledged_at,
    p_ip_address,p_user_agent,p_idempotency_key,p_referral_source,p_referral_source_other_text,
    v_component_ids
  );
  v_group_id := nullif(v_result->>'registration_group_id','')::uuid;
  select participant_id into v_participant_id from public.registration_groups where id=v_group_id;
  insert into public.registration_legal_package_acceptances
    (participant_id,registration_group_id,legal_package_id,package_version,package_effective_at,package_content_hash,component_versions,accepted_at,acceptance_method,ip_address,user_agent)
  values
    (v_participant_id,v_group_id,p_legal_package_id,v_package_version,v_package_effective_at,v_package_content_hash,v_components,coalesce(p_participation_acknowledged_at,now()),'PUBLIC_REGISTRATION',p_ip_address,p_user_agent)
  on conflict (registration_group_id,legal_package_id) do nothing;
  return v_result;
end;
$$;

revoke all on function public.register_selected_events_with_legal(
  text,text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[],uuid
) from public;
grant execute on function public.register_selected_events_with_legal(
  text,text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[],uuid
) to anon, authenticated;
