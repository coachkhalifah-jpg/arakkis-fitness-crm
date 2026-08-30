-- RC2 same-series participant booking transfer.
-- Migration 0029/0052 contain the original behavior and remain immutable.

create or replace function public.get_participant_booking_alternatives(
  p_token text,
  p_registration_id uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_participant_id uuid;
  v_source public.registrations;
  v_series uuid;
  v_result jsonb;
begin
  v_participant_id := public.phase10_resolve_booking_access(p_token, p_registration_id);
  if v_participant_id is null then return null; end if;

  select r.* into v_source
  from public.registrations r
  where r.id = p_registration_id and r.participant_id = v_participant_id;
  if not found then return null; end if;

  select e.event_series_id into v_series
  from public.events e
  where e.id = v_source.event_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'event_id', e.id,
    'name', e.name,
    'starts_at', e.starts_at,
    'ends_at', e.ends_at,
    'timezone', e.timezone,
    'venue_name', v.name,
    'venue_street', v.street,
    'venue_city', v.city,
    'venue_state', v.state,
    'venue_postal_code', v.postal_code,
    'host_organization_name', o.name,
    'capacity', e.capacity,
    'active_registration_count', (
      select count(*)::integer
      from public.registrations r2
      where r2.event_id = e.id
        and r2.registration_status = 'REGISTERED'
        and r2.registration_outcome = 'ACTIVE'
    ),
    'location_updated', e.location_override_venue_id is not null
  ) order by e.starts_at), '[]'::jsonb) into v_result
  from public.events e
  join public.organizations o
    on o.id = e.host_organization_id
   and o.active_status = 'ACTIVE'
  join public.venues v
    on v.id = coalesce(e.location_override_venue_id, e.venue_id)
   and v.organization_id = e.host_organization_id
   and v.active_status = 'ACTIVE'
  where v_series is not null
    and e.event_series_id = v_series
    and e.id <> v_source.event_id
    and e.archived_at is null
    and e.starts_at > now()
    and e.starts_at <= now() + interval '14 days'
    and e.status = 'OPEN'
    and e.publication_status = 'PUBLISHED'
    and e.registration_paused_at is null
    and (e.registration_opens_at is null or e.registration_opens_at <= now())
    and (e.registration_closes_at is null or e.registration_closes_at > now())
    and e.registration_deadline >= now()
    and not exists (
      select 1
      from public.registrations r3
      where r3.participant_id = v_participant_id
        and r3.event_id = e.id
        and r3.registration_status = 'REGISTERED'
        and r3.registration_outcome = 'ACTIVE'
    )
    and (
      select count(*)
      from public.registrations r4
      where r4.event_id = e.id
        and r4.registration_status = 'REGISTERED'
        and r4.registration_outcome = 'ACTIVE'
    ) < e.capacity;

  return v_result;
end;
$$;

create or replace function public.manage_participant_booking(
  p_token text,
  p_action text,
  p_registration_id uuid,
  p_target_event_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_participant_id uuid;
  v_source public.registrations;
  v_source_event public.events;
  v_target public.events;
  v_existing_audit_id uuid;
  v_existing_new_id uuid;
  v_new_id uuid;
begin
  v_participant_id := public.phase10_resolve_booking_access(p_token, p_registration_id);
  if v_participant_id is null then
    raise exception 'booking access is invalid' using errcode = '42501';
  end if;

  select r.* into v_source
  from public.registrations r
  where r.id = p_registration_id
    and r.participant_id = v_participant_id
  for update;
  if not found then
    raise exception 'booking was not found' using errcode = '42501';
  end if;

  -- Read without locking first so transfer locks can be acquired in a
  -- deterministic Event-id order. The source Registration remains locked.
  select e.* into v_source_event
  from public.events e
  where e.id = v_source.event_id;

  if p_action = 'CANCEL' then
    select e.* into v_source_event from public.events e where e.id = v_source.event_id for update;
    if v_source.registration_status <> 'REGISTERED' or v_source.registration_outcome <> 'ACTIVE' then
      raise exception 'booking is not active';
    end if;
    if v_source_event.starts_at <= now() then
      raise exception 'booking can no longer be cancelled';
    end if;
    update public.registrations
    set registration_status = 'CANCELLED',
        registration_outcome = 'PARTICIPANT_CANCELLED',
        cancelled_at = now(),
        cancellation_reason = 'Participant cancelled booking'
    where id = v_source.id;
    insert into public.participant_booking_audits(
      participant_id, registration_id, action, source_event_id,
      old_venue_id, new_venue_id, result, metadata
    ) values (
      v_participant_id, v_source.id, 'CANCELLED', v_source.event_id,
      public.phase10_actual_venue_id(v_source.event_id),
      public.phase10_actual_venue_id(v_source.event_id), 'SUCCESS',
      jsonb_build_object('cancellation_policy', 'NO_PAYMENT_EXECUTED')
    );
    return jsonb_build_object('status', 'CANCELLED', 'registration_id', v_source.id);
  elsif p_action = 'RESTORE' then
    select e.* into v_source_event from public.events e where e.id = v_source.event_id for update;
    if v_source.registration_status <> 'CANCELLED' or v_source.registration_outcome <> 'PARTICIPANT_CANCELLED' then
      raise exception 'only participant-cancelled bookings can be restored';
    end if;
    if v_source_event.starts_at <= now()
       or v_source_event.status <> 'OPEN'
       or v_source_event.publication_status <> 'PUBLISHED'
       or v_source_event.registration_paused_at is not null
       or (v_source_event.registration_opens_at is not null and v_source_event.registration_opens_at > now())
       or (v_source_event.registration_closes_at is not null and v_source_event.registration_closes_at <= now())
       or v_source_event.registration_deadline < now()
       or v_source_event.archived_at is not null then
      raise exception 'booking is no longer bookable';
    end if;
    if not exists (
      select 1 from public.venues v
      where v.id = public.phase10_actual_venue_id(v_source.event_id)
        and v.active_status = 'ACTIVE'
    ) then
      raise exception 'venue is unavailable';
    end if;
    if exists (
      select 1 from public.registrations r
      where r.participant_id = v_participant_id
        and r.event_id = v_source.event_id
        and r.id <> v_source.id
        and r.registration_status = 'REGISTERED'
        and r.registration_outcome = 'ACTIVE'
    ) then
      raise exception 'booking already exists';
    end if;
    if (
      select count(*) from public.registrations r
      where r.event_id = v_source.event_id
        and r.registration_status = 'REGISTERED'
        and r.registration_outcome = 'ACTIVE'
    ) >= v_source_event.capacity then
      raise exception 'booking is full';
    end if;
    update public.registrations
    set registration_status = 'REGISTERED',
        registration_outcome = 'ACTIVE',
        cancelled_at = null,
        cancellation_reason = null
    where id = v_source.id;
    insert into public.participant_booking_audits(
      participant_id, registration_id, action, source_event_id,
      old_venue_id, new_venue_id, result, metadata
    ) values (
      v_participant_id, v_source.id, 'RESTORED', v_source.event_id,
      public.phase10_actual_venue_id(v_source.event_id),
      public.phase10_actual_venue_id(v_source.event_id), 'SUCCESS', '{}'::jsonb
    );
    return jsonb_build_object('status', 'REGISTERED', 'registration_id', v_source.id);
  elsif p_action = 'TRANSFER' then
    if p_target_event_id is null or p_target_event_id = v_source.event_id then
      raise exception 'choose an alternative occurrence';
    end if;
    v_target := null;

    -- Lock both occurrence rows in a stable order to keep concurrent transfers
    -- fail-safe without introducing a source/target lock inversion.
    if v_source.event_id < p_target_event_id then
      select e.* into v_source_event from public.events e where e.id = v_source.event_id for update;
      select e.* into v_target from public.events e where e.id = p_target_event_id for update;
    else
      select e.* into v_target from public.events e where e.id = p_target_event_id for update;
      select e.* into v_source_event from public.events e where e.id = v_source.event_id for update;
    end if;

    if v_target.id is null then
      raise exception 'alternative occurrence is unavailable';
    end if;
    if v_target.event_series_id is distinct from v_source_event.event_series_id then
      raise exception 'alternative occurrence is unavailable';
    end if;

    -- A committed transfer is the idempotency record. A client retry returns
    -- its original destination rather than creating another Registration.
    select a.id, (a.metadata ->> 'destination_registration_id')::uuid
      into v_existing_audit_id, v_existing_new_id
    from public.participant_booking_audits a
    where a.participant_id = v_participant_id
      and a.registration_id = v_source.id
      and a.action = 'TRANSFERRED'
      and a.source_event_id = v_source.event_id
      and a.target_event_id = v_target.id
      and a.result = 'SUCCESS'
    order by a.created_at desc
    limit 1;
    if v_existing_audit_id is not null then
      if not exists (
        select 1 from public.registrations r
        where r.id = v_existing_new_id
          and r.participant_id = v_participant_id
          and r.event_id = v_target.id
          and r.registration_status = 'REGISTERED'
          and r.registration_outcome = 'ACTIVE'
      ) then
        raise exception 'transfer history is inconsistent';
      end if;
      return jsonb_build_object(
        'status', 'TRANSFERRED',
        'registration_id', v_existing_new_id,
        'source_registration_id', v_source.id,
        'idempotent', true
      );
    end if;

    if v_source.registration_status <> 'REGISTERED' or v_source.registration_outcome <> 'ACTIVE' then
      raise exception 'booking is not active';
    end if;

    if v_target.starts_at <= now()
       or v_target.status <> 'OPEN'
       or v_target.publication_status <> 'PUBLISHED'
       or v_target.archived_at is not null
       or v_target.registration_paused_at is not null
       or (v_target.registration_opens_at is not null and v_target.registration_opens_at > now())
       or (v_target.registration_closes_at is not null and v_target.registration_closes_at <= now())
       or v_target.registration_deadline < now() then
      raise exception 'alternative occurrence is unavailable';
    end if;
    if not exists (
      select 1
      from public.organizations o
      join public.venues v
        on v.id = public.phase10_actual_venue_id(v_target.id)
       and v.organization_id = o.id
       and v.active_status = 'ACTIVE'
      where o.id = v_target.host_organization_id
        and o.active_status = 'ACTIVE'
    ) then
      raise exception 'alternative venue is unavailable';
    end if;
    if exists (
      select 1 from public.registrations r
      where r.participant_id = v_participant_id
        and r.event_id = v_target.id
        and r.registration_status = 'REGISTERED'
        and r.registration_outcome = 'ACTIVE'
    ) then
      raise exception 'booking already exists';
    end if;
    if (
      select count(*) from public.registrations r
      where r.event_id = v_target.id
        and r.registration_status = 'REGISTERED'
        and r.registration_outcome = 'ACTIVE'
    ) >= v_target.capacity then
      raise exception 'alternative occurrence is full';
    end if;

    insert into public.registrations(
      registration_group_id, participant_id, event_id,
      affiliation_organization_id_at_registration,
      affiliation_other_text_at_registration, registration_status,
      registration_outcome, created_by_admin_id, referral_source,
      referral_source_other_text
    ) values (
      v_source.registration_group_id, v_participant_id, v_target.id,
      v_source.affiliation_organization_id_at_registration,
      v_source.affiliation_other_text_at_registration, 'REGISTERED',
      'ACTIVE', null, v_source.referral_source, v_source.referral_source_other_text
    ) returning id into v_new_id;

    update public.registrations
    set registration_status = 'CANCELLED',
        registration_outcome = 'PARTICIPANT_CANCELLED',
        cancelled_at = now(),
        cancellation_reason = 'Transferred to another occurrence'
    where id = v_source.id;

    insert into public.participant_booking_audits(
      participant_id, registration_id, action, source_event_id, target_event_id,
      old_venue_id, new_venue_id, result, metadata
    ) values (
      v_participant_id, v_source.id, 'TRANSFERRED', v_source.event_id, v_target.id,
      public.phase10_actual_venue_id(v_source.event_id),
      public.phase10_actual_venue_id(v_target.id), 'SUCCESS',
      jsonb_build_object(
        'source_registration_id', v_source.id,
        'destination_registration_id', v_new_id,
        'source_event_id', v_source.event_id,
        'target_event_id', v_target.id,
        'registration_group_id', v_source.registration_group_id
      )
    );
    return jsonb_build_object(
      'status', 'TRANSFERRED',
      'registration_id', v_new_id,
      'source_registration_id', v_source.id,
      'idempotent', false
    );
  else
    raise exception 'unsupported booking action';
  end if;
end;
$$;

create unique index if not exists participant_booking_transfer_success_uq
  on public.participant_booking_audits (registration_id, target_event_id)
  where action = 'TRANSFERRED' and result = 'SUCCESS';

revoke all on function public.get_participant_booking_alternatives(text, uuid) from public;
revoke all on function public.manage_participant_booking(text, text, uuid, uuid) from public;
grant execute on function public.get_participant_booking_alternatives(text, uuid) to service_role;
grant execute on function public.manage_participant_booking(text, text, uuid, uuid) to service_role;
