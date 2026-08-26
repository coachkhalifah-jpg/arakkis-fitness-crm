-- Phase 5: remove an active registration from an operational roster without
-- deleting participant, registration, attendance, or historical evidence.
create or replace function public.phase5_remove_registration_from_roster(p_registration_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  actor uuid := auth.uid();
  registration_row public.registrations%rowtype;
  event_row public.events%rowtype;
  attendance_row public.attendance%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select r.* into registration_row from public.registrations r where r.id = p_registration_id for update;
  if not found or not public.has_event_access(registration_row.event_id) then
    raise exception 'registration unavailable' using errcode = '42501';
  end if;
  select e.* into event_row from public.events e where e.id = registration_row.event_id for update;
  if event_row.status in ('DRAFT', 'CANCELLED') then raise exception 'event unavailable' using errcode = '42501'; end if;
  if event_row.attendance_processing_state = 'FINALIZED' then raise exception 'attendance finalized' using errcode = '42501'; end if;
  if registration_row.registration_status <> 'REGISTERED' or registration_row.registration_outcome <> 'ACTIVE' then
    raise exception 'registration already removed';
  end if;
  select a.* into attendance_row from public.attendance a where a.registration_id = registration_row.id for update;
  update public.registrations
    set registration_status = 'CANCELLED', registration_outcome = 'ADMIN_CANCELLED',
        cancelled_at = now(), cancellation_reason = 'Removed from roster by authorized administrator'
    where id = registration_row.id;
  insert into public.audit_events(actor_admin_id, action, entity_type, entity_id, old_values, new_values, reason)
  values (
    actor, 'REGISTRATION_REMOVED_FROM_ROSTER', 'REGISTRATION', registration_row.id,
    jsonb_build_object('event_id', registration_row.event_id, 'participant_id', registration_row.participant_id,
      'registration_status', registration_row.registration_status, 'registration_outcome', registration_row.registration_outcome,
      'attendance_status', attendance_row.status),
    jsonb_build_object('event_id', registration_row.event_id, 'participant_id', registration_row.participant_id,
      'registration_status', 'CANCELLED', 'registration_outcome', 'ADMIN_CANCELLED'),
    'Operational roster removal'
  );
  return jsonb_build_object('event_id', registration_row.event_id, 'registration_id', registration_row.id, 'capacity_released', true);
end;
$$;
revoke all on function public.phase5_remove_registration_from_roster(uuid) from public;
grant execute on function public.phase5_remove_registration_from_roster(uuid) to authenticated;
