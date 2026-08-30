-- 0065 — RC2-A registration integrity
-- Keep newly issued confirmation tokens compatible with the established
-- URL-safe confirmation lookup contract. Historical token hashes are untouched.
create or replace function public.register_selected_events_with_legal(
  p_first_name text,p_last_name text,p_display_phone text,p_normalized_phone text,p_phone_country text,
  p_email text,p_normalized_email text,p_fitness_experience text,p_goals text,p_event_ids uuid[],
  p_participation_acknowledgment_version_id uuid,p_data_use_acknowledgment_version_id uuid,
  p_participation_acknowledged_at timestamptz,p_data_use_acknowledged_at timestamptz,
  p_ip_address inet,p_user_agent text,p_idempotency_key text,p_referral_source text,
  p_referral_source_other_text text,p_legal_document_version_ids uuid[],p_legal_package_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
<<registration>>
declare
  participant_id uuid; group_id uuid; event_id uuid; event_row public.events%rowtype;
  registration_id uuid; token text := translate(rtrim(encode(gen_random_bytes(32), 'base64'), '='), '+/', '-_');
  result jsonb := '[]'::jsonb; active_count integer; waiver_id uuid;
begin
  if coalesce(array_length(p_event_ids, 1), 0) = 0 then raise exception 'at least one event is required'; end if;
  if p_user_agent is null or p_ip_address is null then raise exception 'registration evidence is required'; end if;
  if p_idempotency_key is not null then
    select id into group_id from public.registration_groups where submission_source='PUBLIC' and idempotency_key=p_idempotency_key;
    if group_id is not null then
      return jsonb_build_object('registration_group_id',group_id,'confirmation_token',null,'results',coalesce((select jsonb_agg(jsonb_build_object('event_id',r.event_id,'registration_id',r.id,'success',true)) from public.registrations r where r.registration_group_id=group_id),'[]'::jsonb));
    end if;
  end if;
  if not public.legal_package_is_valid(p_legal_package_id) then raise exception 'current legal package is unavailable' using errcode='22023'; end if;
  select c.acknowledgment_version_id into waiver_id from public.legal_package_components c where c.legal_package_id=p_legal_package_id and c.document_type='EOKE_PARTICIPATION_WAIVER';
  if p_participation_acknowledgment_version_id is distinct from waiver_id
     or coalesce(array_length(p_legal_document_version_ids,1),0) <> 1
     or p_legal_document_version_ids[1] is distinct from waiver_id
     or p_data_use_acknowledgment_version_id is not null then
    raise exception 'the current waiver acknowledgment is required' using errcode='22023';
  end if;
  select p.id into participant_id
    from public.participants p
   where p.status='ACTIVE'
     and p.normalized_phone=p_normalized_phone
     and p.normalized_first_name=lower(btrim(regexp_replace(normalize(p_first_name, NFKC), '[[:space:]]+', ' ', 'g')))
     and p.normalized_last_name=lower(btrim(regexp_replace(normalize(p_last_name, NFKC), '[[:space:]]+', ' ', 'g')))
   order by p.created_at limit 1 for update;
  if participant_id is null then
    insert into public.participants(first_name,last_name,normalized_first_name,normalized_last_name,display_phone,normalized_phone,phone_country,email,normalized_email,fitness_experience,goals)
    values(p_first_name,p_last_name,
      lower(btrim(regexp_replace(normalize(p_first_name, NFKC), '[[:space:]]+', ' ', 'g'))),
      lower(btrim(regexp_replace(normalize(p_last_name, NFKC), '[[:space:]]+', ' ', 'g'))),
      p_display_phone,p_normalized_phone,p_phone_country,p_email,p_normalized_email,p_fitness_experience,nullif(btrim(p_goals),'')) returning id into participant_id;
  else
    update public.participants set goals=nullif(btrim(p_goals),'') where id=participant_id and p_goals is not null;
  end if;
  insert into public.registration_groups(participant_id,submission_source,participation_acknowledgment_version_id,participation_acknowledged_at,data_use_acknowledgment_version_id,data_use_acknowledged_at,idempotency_key)
  values(participant_id,'PUBLIC',waiver_id,coalesce(p_participation_acknowledged_at,now()),null,null,p_idempotency_key) returning id into group_id;
  insert into public.acknowledgment_acceptances(participant_id,registration_group_id,acknowledgment_version_id,accepted_at,acceptance_method,ip_address,user_agent)
  values(participant_id,group_id,waiver_id,coalesce(p_participation_acknowledged_at,now()),'PUBLIC_REGISTRATION',p_ip_address,p_user_agent);
  insert into public.registration_legal_package_acceptances(participant_id,registration_group_id,legal_package_id,package_version,package_effective_at,package_content_hash,component_versions,accepted_at,acceptance_method,ip_address,user_agent)
  select participant_id,group_id,p.id,p.package_version,p.effective_at,p.content_hash,jsonb_build_array(jsonb_build_object('type','EOKE_PARTICIPATION_WAIVER','id',waiver_id,'version',v.version,'content_hash',encode(v.content_hash,'hex'))),coalesce(p_participation_acknowledged_at,now()),'PUBLIC_REGISTRATION',p_ip_address,p_user_agent
  from public.legal_packages p join public.acknowledgment_versions v on v.id=waiver_id where p.id=p_legal_package_id;
  foreach event_id in array p_event_ids loop
    select * into event_row from public.events where id=event_id for update;
    if not found then result:=result||jsonb_build_object('event_id',event_id,'success',false,'reason','NOT_FOUND'); continue; end if;
    if event_row.status<>'OPEN' or event_row.registration_deadline<now() or event_row.starts_at<=now() then result:=result||jsonb_build_object('event_id',event_id,'success',false,'reason','CLOSED'); continue; end if;
    if exists(select 1 from public.registrations r where r.participant_id=registration.participant_id and r.event_id=registration.event_id and r.registration_status='REGISTERED' and r.registration_outcome='ACTIVE') then result:=result||jsonb_build_object('event_id',event_id,'success',false,'reason','ALREADY_REGISTERED'); continue; end if;
    select count(*) into active_count from public.registrations r where r.event_id=registration.event_id and r.registration_status='REGISTERED' and r.registration_outcome='ACTIVE';
    if active_count>=event_row.capacity then result:=result||jsonb_build_object('event_id',event_id,'success',false,'reason','FULL'); continue; end if;
    insert into public.registrations(registration_group_id,participant_id,event_id) values(group_id,participant_id,event_id) returning id into registration_id;
    result:=result||jsonb_build_object('event_id',event_id,'registration_id',registration_id,'success',true);
  end loop;
  insert into public.registration_group_results(registration_group_id,event_id,success,reason,registration_id)
  select group_id,(item->>'event_id')::uuid,(item->>'success')::boolean,item->>'reason',nullif(item->>'registration_id','')::uuid
    from jsonb_array_elements(result) item;
  insert into public.confirmation_tokens(registration_group_id,token_hash,expires_at) values(group_id,digest(token,'sha256'),now()+interval '24 hours');
  return jsonb_build_object('registration_group_id',group_id,'confirmation_token',token,'results',result);
end;
$$;

revoke all on function public.register_selected_events_with_legal(text,text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[],uuid) from public;
grant execute on function public.register_selected_events_with_legal(text,text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[],uuid) to anon, authenticated;
