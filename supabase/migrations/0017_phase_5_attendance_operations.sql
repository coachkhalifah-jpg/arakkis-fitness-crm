-- Phase 5: scoped attendance operations.  No new domain status values are introduced.
alter table public.registrations drop constraint registrations_override_fk;
alter table public.registrations add constraint registrations_override_fk foreign key (over_capacity_override_id) references public.over_capacity_overrides(id) on delete restrict deferrable initially deferred;

create or replace function public.record_attendance_transition()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare actor uuid := coalesce(new.updated_by_admin_id, auth.uid());
begin
  if auth.uid() is not null and new.updated_by_admin_id is distinct from auth.uid() then
    raise exception 'attendance actor must be the authenticated administrator' using errcode = '42501';
  end if;
  if actor is null then raise exception 'attendance transition requires an administrator' using errcode = '42501'; end if;
  if tg_op = 'INSERT' then
    insert into public.attendance_transitions (attendance_id, from_status, to_status, changed_by_admin_id, source)
    values (new.id, null, new.status, actor, case when new.status = 'NO_SHOW' then 'FINALIZE' else 'CHECK_IN' end);
  elsif old.status is distinct from new.status or old.checked_in_at is distinct from new.checked_in_at or old.finalized_at is distinct from new.finalized_at then
    insert into public.attendance_transitions (attendance_id, from_status, to_status, changed_by_admin_id, source, reason)
    values (new.id, old.status, new.status, actor, 'CORRECTION', 'Database-recorded attendance change');
  end if;
  return new;
end;
$$;

create or replace function public.phase5_require_event(p_event_id uuid)
returns public.events language plpgsql security definer set search_path = public, auth as $$
declare e public.events%rowtype;
begin
  if auth.uid() is null or not public.has_event_access(p_event_id) then raise exception 'event unavailable' using errcode = '42501'; end if;
  select * into e from public.events where id = p_event_id for update;
  if not found or e.status in ('DRAFT', 'CANCELLED') then raise exception 'event unavailable' using errcode = '42501'; end if;
  return e;
end;
$$;

create or replace function public.phase5_open_attendance(p_event_id uuid)
returns public.events language plpgsql security definer set search_path = public, auth as $$
declare e public.events%rowtype; actor uuid := auth.uid();
begin
  e := public.phase5_require_event(p_event_id);
  if e.attendance_processing_state = 'FINALIZED' then raise exception 'attendance finalized' using errcode = '42501'; end if;
  if e.attendance_processing_state = 'OPEN' then return e; end if;
  update public.events set attendance_processing_state = 'OPEN' where id = p_event_id returning * into e;
  insert into public.audit_events(actor_admin_id, action, entity_type, entity_id, new_values)
    values (actor, 'ATTENDANCE_OPENED', 'EVENT', p_event_id, jsonb_build_object('state', 'OPEN'));
  return e;
end;
$$;

create or replace function public.phase5_mark_attendance(p_registration_id uuid, p_status public.attendance_status, p_reason text default null)
returns public.attendance language plpgsql security definer set search_path = public, auth as $$
declare registration_row public.registrations%rowtype; e public.events%rowtype; a public.attendance%rowtype; actor uuid := auth.uid();
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select regs.* into registration_row from public.registrations regs where regs.id = p_registration_id for update;
  if not found or not public.has_event_access(registration_row.event_id) then raise exception 'registration unavailable' using errcode = '42501'; end if;
  select event_row.* into e from public.events event_row where event_row.id = registration_row.event_id for update;
  if e.status in ('DRAFT', 'CANCELLED') then raise exception 'event unavailable' using errcode = '42501'; end if;
  if e.attendance_processing_state not in ('OPEN', 'REOPENED', 'FINALIZED') then raise exception 'attendance is not open' using errcode = '42501'; end if;
  if e.attendance_processing_state = 'FINALIZED' and not public.is_active_system_admin() then raise exception 'attendance finalized' using errcode = '42501'; end if;
  if registration_row.registration_status = 'CANCELLED' and p_status in ('ATTENDED', 'NO_SHOW') then raise exception 'registration unavailable' using errcode = '42501'; end if;
  if p_status = 'NO_SHOW' and e.attendance_processing_state <> 'FINALIZED' then raise exception 'no-show requires finalization' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) = 0 and e.attendance_processing_state = 'FINALIZED' then raise exception 'correction reason is required' using errcode = '22023'; end if;
  select * into a from public.attendance where registration_id = p_registration_id for update;
  if not found then
    insert into public.attendance(registration_id, status, checked_in_at, finalized_at, updated_by_admin_id)
      values (p_registration_id, p_status, case when p_status = 'ATTENDED' then now() end, case when e.attendance_processing_state = 'FINALIZED' then now() end, actor) returning * into a;
  else
    update public.attendance set status = p_status, checked_in_at = case when p_status = 'ATTENDED' then coalesce(checked_in_at, now()) else null end,
      finalized_at = case when e.attendance_processing_state = 'FINALIZED' then coalesce(finalized_at, now()) else finalized_at end,
      updated_by_admin_id = actor, updated_at = now() where id = a.id returning * into a;
  end if;
  insert into public.audit_events(actor_admin_id, action, entity_type, entity_id, reason, old_values, new_values)
    values (actor, case when p_status = 'NO_SHOW' then 'ATTENDANCE_NO_SHOW_RECORDED' else 'ATTENDANCE_MARKED' end, 'ATTENDANCE', a.id, nullif(btrim(p_reason), ''), jsonb_build_object('registration_id', p_registration_id), jsonb_build_object('status', p_status));
  return a;
end;
$$;

create or replace function public.phase5_finalize_attendance(p_event_id uuid)
returns public.events language plpgsql security definer set search_path = public, auth as $$
declare e public.events%rowtype; r public.registrations%rowtype; a public.attendance%rowtype; actor uuid := auth.uid();
begin
  e := public.phase5_require_event(p_event_id);
  if e.attendance_processing_state = 'FINALIZED' then return e; end if;
  if e.attendance_processing_state not in ('OPEN', 'REOPENED') then raise exception 'attendance is not open' using errcode = '42501'; end if;
  for r in select * from public.registrations where event_id = p_event_id and registration_status = 'REGISTERED' and registration_outcome = 'ACTIVE' for update loop
    select * into a from public.attendance where registration_id = r.id for update;
    if not found then
      insert into public.attendance(registration_id, status, finalized_at, updated_by_admin_id) values (r.id, 'NO_SHOW', now(), actor);
    elsif a.status = 'NOT_RECORDED' then
      update public.attendance set status = 'NO_SHOW', finalized_at = now(), updated_by_admin_id = actor, updated_at = now() where id = a.id;
    end if;
  end loop;
  update public.events set attendance_processing_state = 'FINALIZED' where id = p_event_id returning * into e;
  insert into public.audit_events(actor_admin_id, action, entity_type, entity_id, new_values)
    values (actor, 'ATTENDANCE_FINALIZED', 'EVENT', p_event_id, jsonb_build_object('state', 'FINALIZED'));
  return e;
end;
$$;

create or replace function public.phase5_reopen_attendance(p_event_id uuid, p_reason text)
returns public.events language plpgsql security definer set search_path = public, auth as $$
declare e public.events%rowtype; actor uuid := auth.uid();
begin
  if not public.is_active_system_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'reason is required' using errcode = '22023'; end if;
  e := public.phase5_require_event(p_event_id);
  if e.attendance_processing_state <> 'FINALIZED' then raise exception 'attendance is not finalized' using errcode = '42501'; end if;
  update public.events set attendance_processing_state = 'REOPENED' where id = p_event_id returning * into e;
  insert into public.audit_events(actor_admin_id, action, entity_type, entity_id, reason, new_values)
    values (actor, 'ATTENDANCE_REOPENED', 'EVENT', p_event_id, btrim(p_reason), jsonb_build_object('state', 'REOPENED'));
  return e;
end;
$$;

create or replace function public.phase5_create_walk_in(
  p_event_id uuid, p_first_name text, p_last_name text, p_display_phone text, p_normalized_phone text,
  p_phone_country text, p_email text, p_normalized_email text, p_affiliation_organization_id uuid,
  p_affiliation_other_text text, p_participation_acknowledgment_version_id uuid, p_data_use_acknowledgment_version_id uuid,
  p_ip_address inet, p_user_agent text, p_over_capacity_reason text default null
)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare e public.events%rowtype; actor uuid := auth.uid(); matched_participant_id uuid; group_id uuid; walkin_registration_id uuid; existing_source public.submission_source; active_count integer; override_id uuid; a public.attendance%rowtype;
begin
  e := public.phase5_require_event(p_event_id);
  if e.attendance_processing_state <> 'OPEN' then raise exception 'attendance is not open' using errcode = '42501'; end if;
  if char_length(btrim(p_first_name)) = 0 or char_length(btrim(p_last_name)) = 0 or char_length(btrim(p_normalized_phone)) = 0 then raise exception 'participant fields are required' using errcode = '22023'; end if;
  if not exists (select 1 from public.acknowledgment_versions where id = p_participation_acknowledgment_version_id and type = 'PARTICIPATION_RISK' and legal_status in ('APPROVED','PROVISIONAL')) then raise exception 'invalid Participation acknowledgment version' using errcode = '22023'; end if;
  if not exists (select 1 from public.acknowledgment_versions where id = p_data_use_acknowledgment_version_id and type = 'DATA_USE' and legal_status in ('APPROVED','PROVISIONAL')) then raise exception 'invalid Data Use acknowledgment version' using errcode = '22023'; end if;
  select p.id into matched_participant_id from public.participants p where p.normalized_phone = p_normalized_phone and p.normalized_first_name = lower(btrim(p_first_name)) and p.normalized_last_name = lower(btrim(p_last_name)) order by p.created_at limit 1 for update;
  if matched_participant_id is null then
    insert into public.participants(first_name,last_name,normalized_first_name,normalized_last_name,display_phone,normalized_phone,phone_country,email,normalized_email,primary_affiliation_organization_id,affiliation_other_text)
      values (btrim(p_first_name),btrim(p_last_name),lower(btrim(p_first_name)),lower(btrim(p_last_name)),btrim(p_display_phone),p_normalized_phone,upper(btrim(p_phone_country)),nullif(btrim(p_email),''),nullif(lower(btrim(p_normalized_email)),''),p_affiliation_organization_id,nullif(btrim(p_affiliation_other_text),'')) returning id into matched_participant_id;
    insert into public.audit_events(actor_admin_id,action,entity_type,entity_id,new_values) values(actor,'WALK_IN_PARTICIPANT_CREATED','PARTICIPANT',matched_participant_id,jsonb_build_object('event_id',p_event_id));
  end if;
  select r.id, rg.submission_source into walkin_registration_id, existing_source from public.registrations r join public.registration_groups rg on rg.id = r.registration_group_id where r.participant_id = matched_participant_id and r.event_id = p_event_id and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE' for update;
  if walkin_registration_id is null then
    select count(*) into active_count from public.registrations r where r.event_id = p_event_id and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE';
    if active_count >= e.capacity then
      if not public.is_active_system_admin() or char_length(btrim(coalesce(p_over_capacity_reason,''))) = 0 then raise exception 'capacity reached' using errcode = '23514'; end if;
      walkin_registration_id := gen_random_uuid(); override_id := gen_random_uuid();
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

revoke all on function public.phase5_require_event(uuid) from public;
revoke all on function public.phase5_open_attendance(uuid) from public;
revoke all on function public.phase5_mark_attendance(uuid,public.attendance_status,text) from public;
revoke all on function public.phase5_finalize_attendance(uuid) from public;
revoke all on function public.phase5_reopen_attendance(uuid,text) from public;
revoke all on function public.phase5_create_walk_in(uuid,text,text,text,text,text,text,text,uuid,text,uuid,uuid,inet,text,text) from public;
grant execute on function public.phase5_open_attendance(uuid) to authenticated;
grant execute on function public.phase5_mark_attendance(uuid,public.attendance_status,text) to authenticated;
grant execute on function public.phase5_finalize_attendance(uuid) to authenticated;
grant execute on function public.phase5_reopen_attendance(uuid,text) to authenticated;
grant execute on function public.phase5_create_walk_in(uuid,text,text,text,text,text,text,text,uuid,text,uuid,uuid,inet,text,text) to authenticated;
