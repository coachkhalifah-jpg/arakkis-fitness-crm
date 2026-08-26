-- Scoped confirmation access for one proven registration.
-- This intentionally does not issue or persist a remembered-device token.

create or replace function public.get_participant_booking_by_confirmation(
  p_confirmation_token text,
  p_registration_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_group_id uuid;
  v_result jsonb;
begin
  if p_confirmation_token is null
     or p_confirmation_token !~ '^[A-Za-z0-9_-]{40,60}$'
     or p_registration_id is null then
    return null;
  end if;

  select ct.registration_group_id into v_group_id
  from public.confirmation_tokens ct
  join public.registration_group_results gr
    on gr.registration_group_id = ct.registration_group_id
   and gr.registration_id = p_registration_id
   and gr.success
  where ct.token_hash = digest(p_confirmation_token, 'sha256')
    and ct.revoked_at is null
    and ct.expires_at > now();

  if v_group_id is null then return null; end if;

  update public.confirmation_tokens
     set last_accessed_at = now(), access_count = access_count + 1
   where token_hash = digest(p_confirmation_token, 'sha256');

  select jsonb_build_object(
    'registration_id', r.id,
    'event_id', e.id,
    'name', e.name,
    'description', e.description,
    'participant_instructions', e.participant_instructions,
    'starts_at', e.starts_at,
    'ends_at', e.ends_at,
    'timezone', e.timezone,
    'venue_name', v.name,
    'venue_street', v.street,
    'venue_city', v.city,
    'venue_state', v.state,
    'venue_postal_code', v.postal_code,
    'host_organization_name', o.name,
    'location_updated', e.location_override_venue_id is not null,
    'registration_status', r.registration_status,
    'registration_outcome', r.registration_outcome,
    'series_slug', s.public_slug,
    'communication_url', e.communication_url,
    'communication_label', e.communication_label
  ) into v_result
  from public.registrations r
  join public.registration_group_results gr
    on gr.registration_id = r.id
   and gr.registration_group_id = v_group_id
   and gr.success
  join public.events e on e.id = r.event_id
  left join public.organizations o on o.id = e.host_organization_id
  left join public.venues v on v.id = coalesce(e.location_override_venue_id, e.venue_id)
  left join public.event_series s on s.id = e.event_series_id
  where r.id = p_registration_id;

  return v_result;
end;
$$;

revoke all on function public.get_participant_booking_by_confirmation(text, uuid) from public;
grant execute on function public.get_participant_booking_by_confirmation(text, uuid) to service_role;

-- Resolve either remembered-device access, the existing one-use management
-- token, or a confirmation token proven to contain this registration only.
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

  select participant_id into v_participant_id
  from public.participant_remembered_devices
  where token_hash = digest(p_token, 'sha256')
    and revoked_at is null
    and expires_at > now();
  if v_participant_id is not null then
    update public.participant_remembered_devices
       set last_used_at = now()
     where token_hash = digest(p_token, 'sha256');
    return v_participant_id;
  end if;

  select participant_id into v_participant_id
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

  select participant_id into v_participant_id
  from public.registration_groups
  where id = v_group_id;
  if v_participant_id is null then return null; end if;

  update public.confirmation_tokens
     set last_accessed_at = now(), access_count = access_count + 1
   where token_hash = digest(p_token, 'sha256');
  return v_participant_id;
end;
$$;

revoke all on function public.phase10_resolve_booking_access(text, uuid) from public;

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
  v_participant_id := public.phase10_resolve_booking_access(p_token, p_registration_id);
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
