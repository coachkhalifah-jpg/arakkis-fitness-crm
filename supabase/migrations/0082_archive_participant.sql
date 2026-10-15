-- 0082 — DEC-069: System Admin may archive (remove from People) an ACTIVE participant.
-- Soft-archive only: status ACTIVE → ARCHIVED. History, registrations, and notes stay.
-- Directory/search already list ACTIVE only. Phone auto-match ignores ARCHIVED (DEC-062).
-- Blocks when the participant still holds an upcoming ACTIVE registration.

create or replace function public.phase6_archive_participant(
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
  upcoming_count integer := 0;
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
  if participant_row.status <> 'ACTIVE' then
    raise exception 'participant is already archived' using errcode = '22023';
  end if;

  select count(*)::integer into upcoming_count
  from public.registrations r
  join public.events e on e.id = r.event_id
  where r.participant_id = p_participant_id
    and r.registration_status = 'REGISTERED'
    and r.registration_outcome = 'ACTIVE'
    and e.starts_at > now()
    and e.status <> 'CANCELLED';
  if upcoming_count > 0 then
    raise exception 'cancel upcoming bookings before removing this person'
      using errcode = '22023';
  end if;

  update public.participants
  set status = 'ARCHIVED', updated_at = now()
  where id = p_participant_id
    and status = 'ACTIVE';

  update public.participant_manage_recovery_links
  set status = 'REVOKED', revoked_at = now()
  where participant_id = p_participant_id
    and status = 'PENDING';

  insert into public.audit_events(
    actor_admin_id, action, entity_type, entity_id, reason, old_values, new_values
  ) values (
    actor_id,
    'PARTICIPANT_ARCHIVED',
    'participants',
    p_participant_id,
    canonical_reason,
    jsonb_build_object('status', 'ACTIVE'),
    jsonb_build_object('status', 'ARCHIVED')
  );
end;
$function$;

revoke all on function public.phase6_archive_participant(uuid, text) from public;
grant execute on function public.phase6_archive_participant(uuid, text) to authenticated;

comment on function public.phase6_archive_participant(uuid, text) is
  'System Admin soft-archive of an ACTIVE participant (DEC-069); removes from People directory without destroying history.';
