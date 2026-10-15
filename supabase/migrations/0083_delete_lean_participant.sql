-- 0083 — DEC-070: System Admin may permanently delete a participant only when
-- lean (no durable CRM/history children). Prefer DEC-069 archive when history exists.
-- Ephemeral device/recovery/booking-management tokens may be cleared as part of delete.

create or replace function public.phase6_delete_lean_participant(
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
  blocking_reason text;
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

  if exists (
    select 1 from public.registrations r where r.participant_id = p_participant_id
  ) then
    blocking_reason := 'registrations';
  elsif exists (
    select 1 from public.registration_groups g where g.participant_id = p_participant_id
  ) then
    blocking_reason := 'registration groups';
  elsif exists (
    select 1 from public.follow_up_tasks t where t.participant_id = p_participant_id
  ) then
    blocking_reason := 'follow-up tasks';
  elsif exists (
    select 1 from public.participant_notes n where n.participant_id = p_participant_id
  ) then
    blocking_reason := 'notes';
  elsif exists (
    select 1 from public.acknowledgment_acceptances a where a.participant_id = p_participant_id
  ) then
    blocking_reason := 'acknowledgment history';
  elsif exists (
    select 1 from public.registration_legal_acceptances a where a.participant_id = p_participant_id
  ) then
    blocking_reason := 'legal acceptance history';
  elsif exists (
    select 1 from public.registration_legal_package_acceptances a where a.participant_id = p_participant_id
  ) then
    blocking_reason := 'legal package history';
  elsif exists (
    select 1 from public.participant_notification_tasks t where t.participant_id = p_participant_id
  ) then
    blocking_reason := 'notification tasks';
  elsif exists (
    select 1 from public.participant_booking_audits a where a.participant_id = p_participant_id
  ) then
    blocking_reason := 'booking audits';
  elsif exists (
    select 1 from public.possible_duplicate_cases c
    where c.candidate_participant_id = p_participant_id
       or c.possible_match_participant_id = p_participant_id
  ) then
    blocking_reason := 'duplicate review cases';
  elsif exists (
    select 1 from public.participant_merges m
    where m.surviving_participant_id = p_participant_id
       or m.archived_duplicate_participant_id = p_participant_id
  ) then
    blocking_reason := 'merge history';
  end if;

  if blocking_reason is not null then
    raise exception 'cannot permanently delete: this person has % — use Remove from People (archive) instead',
      blocking_reason
      using errcode = '22023';
  end if;

  insert into public.audit_events(
    actor_admin_id, action, entity_type, entity_id, reason, old_values, new_values
  ) values (
    actor_id,
    'PARTICIPANT_DELETED_LEAN',
    'participants',
    p_participant_id,
    canonical_reason,
    jsonb_build_object(
      'status', participant_row.status,
      'first_name', participant_row.first_name,
      'last_name', participant_row.last_name,
      'normalized_phone', participant_row.normalized_phone,
      'email', participant_row.email
    ),
    jsonb_build_object('deleted', true, 'mode', 'lean')
  );

  delete from public.participant_manage_recovery_links where participant_id = p_participant_id;
  delete from public.participant_remembered_devices where participant_id = p_participant_id;
  delete from public.participant_booking_management_tokens where participant_id = p_participant_id;

  delete from public.participants where id = p_participant_id;
end;
$function$;

revoke all on function public.phase6_delete_lean_participant(uuid, text) from public;
grant execute on function public.phase6_delete_lean_participant(uuid, text) to authenticated;

comment on function public.phase6_delete_lean_participant(uuid, text) is
  'System Admin permanent delete of a lean participant with no durable history (DEC-070).';
