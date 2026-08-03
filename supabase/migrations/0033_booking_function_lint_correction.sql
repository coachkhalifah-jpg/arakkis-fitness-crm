-- Forward-only correction for the participant booking RPC.
-- Migration 0029 remains immutable; this removes an unused declaration without changing behavior.

create or replace function public.manage_participant_booking(
  p_token text, p_action text, p_registration_id uuid, p_target_event_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_participant_id uuid;
  v_source public.registrations;
  v_source_event public.events;
  v_target public.events;
  v_new_id uuid;
begin
  v_participant_id := public.phase10_resolve_booking_participant(p_token);
  if v_participant_id is null then raise exception 'booking access is invalid' using errcode='42501'; end if;
  select r.* into v_source from public.registrations r where r.id=p_registration_id and r.participant_id=v_participant_id for update;
  if not found then raise exception 'booking was not found' using errcode='42501'; end if;
  select * into v_source_event from public.events where id=v_source.event_id for update;
  if p_action='CANCEL' then
    if v_source.registration_status <> 'REGISTERED' or v_source.registration_outcome <> 'ACTIVE' then raise exception 'booking is not active'; end if;
    if v_source_event.starts_at <= now() then raise exception 'booking can no longer be cancelled'; end if;
    update public.registrations set registration_status='CANCELLED', registration_outcome='PARTICIPANT_CANCELLED', cancelled_at=now(), cancellation_reason='Participant cancelled booking' where id=v_source.id;
    insert into public.participant_booking_audits(participant_id,registration_id,action,source_event_id,old_venue_id,new_venue_id,result,metadata)
      values(v_participant_id,v_source.id,'CANCELLED',v_source.event_id,public.phase10_actual_venue_id(v_source.event_id),public.phase10_actual_venue_id(v_source.event_id),'SUCCESS',jsonb_build_object('cancellation_policy','NO_PAYMENT_EXECUTED'));
    return jsonb_build_object('status','CANCELLED','registration_id',v_source.id);
  elsif p_action='RESTORE' then
    if v_source.registration_status <> 'CANCELLED' or v_source.registration_outcome <> 'PARTICIPANT_CANCELLED' then raise exception 'only participant-cancelled bookings can be restored'; end if;
    if v_source_event.starts_at <= now() or v_source_event.status <> 'OPEN' or v_source_event.publication_status <> 'PUBLISHED' or v_source_event.registration_paused_at is not null or v_source_event.registration_deadline < now() then raise exception 'booking is no longer bookable'; end if;
    if not exists (select 1 from public.venues v where v.id=public.phase10_actual_venue_id(v_source.event_id) and v.active_status='ACTIVE') then raise exception 'venue is unavailable'; end if;
    if exists (select 1 from public.registrations r where r.participant_id=v_participant_id and r.event_id=v_source.event_id and r.id<>v_source.id and r.registration_status='REGISTERED' and r.registration_outcome='ACTIVE') then raise exception 'booking already exists'; end if;
    if (select count(*) from public.registrations r where r.event_id=v_source.event_id and r.registration_status='REGISTERED' and r.registration_outcome='ACTIVE') >= v_source_event.capacity then raise exception 'booking is full'; end if;
    update public.registrations set registration_status='REGISTERED', registration_outcome='ACTIVE', cancelled_at=null, cancellation_reason=null where id=v_source.id;
    insert into public.participant_booking_audits(participant_id,registration_id,action,source_event_id,old_venue_id,new_venue_id,result,metadata)
      values(v_participant_id,v_source.id,'RESTORED',v_source.event_id,public.phase10_actual_venue_id(v_source.event_id),public.phase10_actual_venue_id(v_source.event_id),'SUCCESS','{}'::jsonb);
    return jsonb_build_object('status','REGISTERED','registration_id',v_source.id);
  elsif p_action='TRANSFER' then
    if v_source.registration_status <> 'REGISTERED' or v_source.registration_outcome <> 'ACTIVE' then raise exception 'booking is not active'; end if;
    if p_target_event_id is null then raise exception 'choose an alternative occurrence'; end if;
    select * into v_target from public.events where id=p_target_event_id for update;
    if not found or v_target.event_series_id is distinct from v_source_event.event_series_id or v_target.starts_at <= now() or v_target.status <> 'OPEN' or v_target.publication_status <> 'PUBLISHED' or v_target.registration_paused_at is not null or v_target.registration_deadline < now() then raise exception 'alternative occurrence is unavailable'; end if;
    if not exists (select 1 from public.venues v where v.id=public.phase10_actual_venue_id(v_target.id) and v.active_status='ACTIVE') then raise exception 'alternative venue is unavailable'; end if;
    if exists (select 1 from public.registrations r where r.participant_id=v_participant_id and r.event_id=v_target.id and r.registration_status='REGISTERED' and r.registration_outcome='ACTIVE') then raise exception 'booking already exists'; end if;
    if (select count(*) from public.registrations r where r.event_id=v_target.id and r.registration_status='REGISTERED' and r.registration_outcome='ACTIVE') >= v_target.capacity then raise exception 'alternative occurrence is full'; end if;
    insert into public.registrations(registration_group_id,participant_id,event_id,affiliation_organization_id_at_registration,affiliation_other_text_at_registration,registration_status,registration_outcome,created_by_admin_id,referral_source,referral_source_other_text)
      values(v_source.registration_group_id,v_participant_id,v_target.id,v_source.affiliation_organization_id_at_registration,v_source.affiliation_other_text_at_registration,'REGISTERED','ACTIVE',null,v_source.referral_source,v_source.referral_source_other_text) returning id into v_new_id;
    update public.registrations set registration_status='CANCELLED',registration_outcome='PARTICIPANT_CANCELLED',cancelled_at=now(),cancellation_reason='Transferred to another occurrence' where id=v_source.id;
    insert into public.participant_booking_audits(participant_id,registration_id,action,source_event_id,target_event_id,old_venue_id,new_venue_id,result,metadata)
      values(v_participant_id,v_source.id,'TRANSFERRED',v_source.event_id,v_target.id,public.phase10_actual_venue_id(v_source.event_id),public.phase10_actual_venue_id(v_target.id),'SUCCESS',jsonb_build_object('new_registration_id',v_new_id));
    return jsonb_build_object('status','TRANSFERRED','registration_id',v_new_id,'source_registration_id',v_source.id);
  else
    raise exception 'unsupported booking action';
  end if;
end;
$$;

revoke all on function public.manage_participant_booking(text,text,uuid,uuid) from public;
grant execute on function public.manage_participant_booking(text,text,uuid,uuid) to service_role;
