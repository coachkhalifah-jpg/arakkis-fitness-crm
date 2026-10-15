-- 0084 — DEC-071 force-delete with history + DEC-072 reactivate ARCHIVED on phone match.
-- Force-delete: System Admin may permanently wipe a participant and all CRM/history children.
-- Uses transaction-local session_replication_role=replica to bypass immutable-evidence triggers
-- and restrict FKs (security definer; System Admin only). Prefer archive (DEC-069) or lean
-- delete (DEC-070) when those suffice.
-- Reactivate: public registration + walk-in prefer ACTIVE phone match; else oldest ARCHIVED
-- row for that phone is reactivated to ACTIVE (prevents twin after Remove from People).

create or replace function public.phase6_force_delete_participant(
  p_participant_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  actor_id uuid := auth.uid();
  participant_row public.participants%rowtype;
  canonical_reason text := btrim(coalesce(p_reason, ''));
  reg_ids uuid[];
  group_ids uuid[];
  attendance_ids uuid[];
  delivery_ids uuid[];
  merge_ids uuid[];
  registration_count integer := 0;
  note_count integer := 0;
  follow_up_count integer := 0;
begin
  if not public.is_active_system_admin() then
    raise exception 'participant unavailable' using errcode = '42501';
  end if;
  if char_length(canonical_reason) = 0 then
    raise exception 'reason is required' using errcode = '22023';
  end if;
  if char_length(canonical_reason) > 500 then
    raise exception 'reason is too long' using errcode = '22023';
  end if;

  select * into participant_row
  from public.participants
  where id = p_participant_id
  for update;
  if not found then
    raise exception 'participant unavailable' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(r.id), '{}'::uuid[]) into reg_ids
  from public.registrations r
  where r.participant_id = p_participant_id;
  registration_count := coalesce(array_length(reg_ids, 1), 0);

  select coalesce(array_agg(g.id), '{}'::uuid[]) into group_ids
  from public.registration_groups g
  where g.participant_id = p_participant_id;

  select coalesce(array_agg(a.id), '{}'::uuid[]) into attendance_ids
  from public.attendance a
  where a.registration_id = any (reg_ids);

  select coalesce(array_agg(d.id), '{}'::uuid[]) into delivery_ids
  from public.participant_notification_deliveries d
  where d.registration_id = any (reg_ids)
     or d.participant_notification_task_id in (
       select t.id from public.participant_notification_tasks t
       where t.participant_id = p_participant_id
     );

  select coalesce(array_agg(m.id), '{}'::uuid[]) into merge_ids
  from public.participant_merges m
  where m.surviving_participant_id = p_participant_id
     or m.archived_duplicate_participant_id = p_participant_id;

  select count(*)::integer into note_count
  from public.participant_notes n where n.participant_id = p_participant_id;
  select count(*)::integer into follow_up_count
  from public.follow_up_tasks t where t.participant_id = p_participant_id;

  insert into public.audit_events(
    actor_admin_id, action, entity_type, entity_id, reason, old_values, new_values
  ) values (
    actor_id,
    'PARTICIPANT_DELETED_FORCE',
    'participants',
    p_participant_id,
    canonical_reason,
    jsonb_build_object(
      'status', participant_row.status,
      'first_name', participant_row.first_name,
      'last_name', participant_row.last_name,
      'normalized_phone', participant_row.normalized_phone,
      'email', participant_row.email,
      'registration_count', registration_count,
      'note_count', note_count,
      'follow_up_count', follow_up_count
    ),
    jsonb_build_object('deleted', true, 'mode', 'force')
  );

  -- Bypass immutable-evidence triggers and restrict FKs for this cascade only.
  perform set_config('session_replication_role', 'replica', true);

  delete from public.notification_delivery_transitions
  where delivery_id = any (delivery_ids);

  delete from public.participant_notification_deliveries
  where id = any (delivery_ids)
     or registration_id = any (reg_ids)
     or participant_notification_task_id in (
       select t.id from public.participant_notification_tasks t
       where t.participant_id = p_participant_id
     );

  delete from public.participant_notification_tasks
  where participant_id = p_participant_id;

  delete from public.attendance_transitions
  where attendance_id = any (attendance_ids);

  delete from public.attendance
  where registration_id = any (reg_ids);

  delete from public.participant_booking_audits
  where participant_id = p_participant_id
     or registration_id = any (reg_ids);

  delete from public.registration_group_results
  where registration_group_id = any (group_ids)
     or registration_id = any (reg_ids);

  delete from public.confirmation_tokens
  where registration_group_id = any (group_ids);

  delete from public.acknowledgment_acceptances
  where participant_id = p_participant_id
     or registration_group_id = any (group_ids);

  delete from public.registration_legal_acceptances
  where participant_id = p_participant_id
     or registration_group_id = any (group_ids);

  delete from public.registration_legal_package_acceptances
  where participant_id = p_participant_id
     or registration_group_id = any (group_ids);

  update public.registrations
  set over_capacity_override_id = null,
      possible_duplicate_case_id = null
  where participant_id = p_participant_id;

  delete from public.over_capacity_overrides
  where registration_id = any (reg_ids);

  -- Clear inbound FKs from other participants before deleting shared duplicate cases.
  update public.registrations
  set possible_duplicate_case_id = null
  where possible_duplicate_case_id in (
    select c.id
    from public.possible_duplicate_cases c
    where c.candidate_participant_id = p_participant_id
       or c.possible_match_participant_id = p_participant_id
       or c.source_registration_group_id = any (group_ids)
       or c.source_registration_id = any (reg_ids)
  );

  update public.possible_duplicate_cases
  set source_registration_id = null
  where source_registration_id = any (reg_ids);

  delete from public.possible_duplicate_cases
  where candidate_participant_id = p_participant_id
     or possible_match_participant_id = p_participant_id
     or source_registration_group_id = any (group_ids)
     or source_registration_id = any (reg_ids);

  delete from public.registrations
  where participant_id = p_participant_id;

  delete from public.registration_groups
  where participant_id = p_participant_id;

  delete from public.follow_up_tasks
  where participant_id = p_participant_id;

  delete from public.participant_notes
  where participant_id = p_participant_id;

  delete from public.participant_merge_conflicts
  where participant_merge_id = any (merge_ids);

  delete from public.participant_merges
  where id = any (merge_ids);

  update public.participant_manage_recovery_links
  set replaced_by_link_id = null,
      consumed_device_id = null
  where participant_id = p_participant_id;

  delete from public.participant_manage_recovery_links
  where participant_id = p_participant_id;

  update public.participant_remembered_devices
  set replaced_by_device_id = null
  where participant_id = p_participant_id;

  delete from public.participant_remembered_devices
  where participant_id = p_participant_id;

  delete from public.participant_booking_management_tokens
  where participant_id = p_participant_id;

  delete from public.participants
  where id = p_participant_id;
end;
$function$;

revoke all on function public.phase6_force_delete_participant(uuid, text) from public;
grant execute on function public.phase6_force_delete_participant(uuid, text) to authenticated;

comment on function public.phase6_force_delete_participant(uuid, text) is
  'System Admin force cascade delete of a participant and all history (DEC-071). Prefer DEC-069 archive or DEC-070 lean delete when applicable.';

-- DEC-072: phone match prefers ACTIVE, else reactivates oldest ARCHIVED (public registration).
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
  matched_status public.participant_status;
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
  -- DEC-062 + DEC-072: prefer ACTIVE phone match; else reactivate oldest ARCHIVED.
  select p.id, p.status into participant_id, matched_status
    from public.participants p
   where p.status='ACTIVE'
     and p.normalized_phone=p_normalized_phone
   order by p.created_at limit 1 for update;
  if participant_id is null then
    select p.id, p.status into participant_id, matched_status
      from public.participants p
     where p.status='ARCHIVED'
       and p.normalized_phone=p_normalized_phone
     order by p.created_at limit 1 for update;
  end if;
  if participant_id is null then
    insert into public.participants(first_name,last_name,normalized_first_name,normalized_last_name,display_phone,normalized_phone,phone_country,email,normalized_email,fitness_experience,goals)
    values(p_first_name,p_last_name,
      lower(btrim(regexp_replace(normalize(p_first_name, NFKC), '[[:space:]]+', ' ', 'g'))),
      lower(btrim(regexp_replace(normalize(p_last_name, NFKC), '[[:space:]]+', ' ', 'g'))),
      p_display_phone,p_normalized_phone,p_phone_country,p_email,p_normalized_email,p_fitness_experience,nullif(btrim(p_goals),'')) returning id into participant_id;
  else
    if matched_status = 'ARCHIVED' then
      update public.participants
         set status='ACTIVE', updated_at=now(),
             goals=case when p_goals is not null then nullif(btrim(p_goals),'') else goals end
       where id=participant_id and status='ARCHIVED';
      insert into public.audit_events(action,entity_type,entity_id,new_values,old_values)
      values(
        'PARTICIPANT_REACTIVATED_ON_REGISTRATION',
        'participants',
        participant_id,
        jsonb_build_object('status','ACTIVE','source','PUBLIC_REGISTRATION'),
        jsonb_build_object('status','ARCHIVED')
      );
    elsif p_goals is not null then
      update public.participants set goals=nullif(btrim(p_goals),'') where id=participant_id;
    end if;
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

-- DEC-072: same reactivate path for walk-in.
create or replace function public.phase5_create_walk_in(
  p_event_id uuid, p_first_name text, p_last_name text, p_display_phone text, p_normalized_phone text,
  p_phone_country text, p_email text, p_normalized_email text, p_affiliation_organization_id uuid,
  p_affiliation_other_text text, p_participation_acknowledgment_version_id uuid, p_data_use_acknowledgment_version_id uuid,
  p_ip_address inet, p_user_agent text, p_over_capacity_reason text default null
)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare e public.events%rowtype; actor uuid := auth.uid(); matched_participant_id uuid; group_id uuid; walkin_registration_id uuid; existing_source public.submission_source; active_count integer; override_id uuid; a public.attendance%rowtype;
  matched_status public.participant_status;
begin
  e := public.phase5_require_event(p_event_id);
  if e.attendance_processing_state <> 'OPEN' then raise exception 'attendance is not open' using errcode = '42501'; end if;
  if char_length(btrim(p_first_name)) = 0 or char_length(btrim(p_last_name)) = 0 or char_length(btrim(p_normalized_phone)) = 0 then raise exception 'participant fields are required' using errcode = '22023'; end if;
  if not exists (select 1 from public.acknowledgment_versions where id = p_participation_acknowledgment_version_id and type = 'PARTICIPATION_RISK' and legal_status in ('APPROVED','PROVISIONAL')) then raise exception 'invalid Participation acknowledgment version' using errcode = '22023'; end if;
  if not exists (select 1 from public.acknowledgment_versions where id = p_data_use_acknowledgment_version_id and type = 'DATA_USE' and legal_status in ('APPROVED','PROVISIONAL')) then raise exception 'invalid Data Use acknowledgment version' using errcode = '22023'; end if;
  select p.id, p.status into matched_participant_id, matched_status
    from public.participants p
   where p.status = 'ACTIVE'
     and p.normalized_phone = p_normalized_phone
   order by p.created_at limit 1 for update;
  if matched_participant_id is null then
    select p.id, p.status into matched_participant_id, matched_status
      from public.participants p
     where p.status = 'ARCHIVED'
       and p.normalized_phone = p_normalized_phone
     order by p.created_at limit 1 for update;
  end if;
  if matched_participant_id is null then
    insert into public.participants(first_name,last_name,normalized_first_name,normalized_last_name,display_phone,normalized_phone,phone_country,email,normalized_email,primary_affiliation_organization_id,affiliation_other_text)
      values (btrim(p_first_name),btrim(p_last_name),lower(btrim(p_first_name)),lower(btrim(p_last_name)),btrim(p_display_phone),p_normalized_phone,upper(btrim(p_phone_country)),nullif(btrim(p_email),''),nullif(lower(btrim(p_normalized_email)),''),p_affiliation_organization_id,nullif(btrim(p_affiliation_other_text),'')) returning id into matched_participant_id;
    insert into public.audit_events(actor_admin_id,action,entity_type,entity_id,new_values) values(actor,'WALK_IN_PARTICIPANT_CREATED','PARTICIPANT',matched_participant_id,jsonb_build_object('event_id',p_event_id));
  elsif matched_status = 'ARCHIVED' then
    update public.participants
       set status = 'ACTIVE', updated_at = now()
     where id = matched_participant_id and status = 'ARCHIVED';
    insert into public.audit_events(actor_admin_id,action,entity_type,entity_id,old_values,new_values)
    values(actor,'PARTICIPANT_REACTIVATED_ON_REGISTRATION','participants',matched_participant_id,
      jsonb_build_object('status','ARCHIVED'),
      jsonb_build_object('status','ACTIVE','source','WALK_IN','event_id',p_event_id));
  end if;
  select r.id, rg.submission_source into walkin_registration_id, existing_source from public.registrations r join public.registration_groups rg on rg.id = r.registration_group_id where r.participant_id = matched_participant_id and r.event_id = p_event_id and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE' for update;
  if walkin_registration_id is null then
    select count(*) into active_count from public.registrations r where r.event_id = p_event_id and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE';
    walkin_registration_id := gen_random_uuid();
    if active_count >= e.capacity then
      if not public.is_active_system_admin() or char_length(btrim(coalesce(p_over_capacity_reason,''))) = 0 then raise exception 'capacity reached' using errcode = '23514'; end if;
      override_id := gen_random_uuid();
      insert into public.over_capacity_overrides(id,event_id,registration_id,approved_by_admin_id,reason,capacity_at_override,active_registration_count_before,active_registration_count_after,source) values(override_id,p_event_id,walkin_registration_id,actor,btrim(p_over_capacity_reason),e.capacity,active_count,active_count+1,'WALK_IN');
    end if;
    insert into public.registration_groups(participant_id,submission_source,participation_acknowledgment_version_id,participation_acknowledged_at,data_use_acknowledgment_version_id,data_use_acknowledged_at,created_by_admin_id) values(matched_participant_id,'WALK_IN',p_participation_acknowledgment_version_id,now(),p_data_use_acknowledgment_version_id,now(),actor) returning id into group_id;
    insert into public.acknowledgment_acceptances(participant_id,registration_group_id,acknowledgment_version_id,acceptance_method,ip_address,user_agent) values(matched_participant_id,group_id,p_participation_acknowledgment_version_id,'ADMIN_WALK_IN',coalesce(p_ip_address,'127.0.0.1'::inet),coalesce(p_user_agent,'local-admin')),(matched_participant_id,group_id,p_data_use_acknowledgment_version_id,'ADMIN_WALK_IN',coalesce(p_ip_address,'127.0.0.1'::inet),coalesce(p_user_agent,'local-admin'));
    insert into public.registrations(id,registration_group_id,participant_id,event_id,affiliation_organization_id_at_registration,affiliation_other_text_at_registration,created_by_admin_id,over_capacity_override_id) values(walkin_registration_id,group_id,matched_participant_id,p_event_id,p_affiliation_organization_id,p_affiliation_other_text,actor,override_id);
    insert into public.audit_events(actor_admin_id,action,entity_type,entity_id,new_values) values(actor,'WALK_IN_REGISTRATION_CREATED','REGISTRATION',walkin_registration_id,jsonb_build_object('event_id',p_event_id));
  end if;
  select a0.* into a from public.attendance a0 where a0.registration_id = walkin_registration_id for update;
  if not found then insert into public.attendance(registration_id,status,checked_in_at,updated_by_admin_id) values(walkin_registration_id,'ATTENDED',now(),actor) returning * into a;
  elsif a.status <> 'ATTENDED' then update public.attendance set status='ATTENDED',checked_in_at=coalesce(checked_in_at,now()),updated_by_admin_id=actor,updated_at=now() where id=a.id returning * into a; end if;
  insert into public.audit_events(actor_admin_id,action,entity_type,entity_id,new_values) values(actor,'WALK_IN_ATTENDANCE_RECORDED','ATTENDANCE',a.id,jsonb_build_object('event_id',p_event_id,'existing_registration',existing_source is not null));
  return jsonb_build_object('participant_id',matched_participant_id,'registration_id',walkin_registration_id,'attendance_id',a.id,'existing_registration',existing_source is not null,'source',coalesce(existing_source::text,'WALK_IN'));
end;
$$;

revoke all on function public.phase5_create_walk_in(uuid,text,text,text,text,text,text,text,uuid,text,uuid,uuid,inet,text,text) from public;
grant execute on function public.phase5_create_walk_in(uuid,text,text,text,text,text,text,text,uuid,text,uuid,uuid,inet,text,text) to authenticated;
