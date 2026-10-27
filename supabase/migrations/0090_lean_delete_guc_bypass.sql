-- 0090 — Hosted-safe lean/force delete bypass (DEC-074 / DEC-071).
-- Hosted smoke after 0089: permission denied to set parameter "session_replication_role".
-- Supabase `postgres` is not a full superuser; set_config('session_replication_role',
-- 'replica') fails even inside SECURITY DEFINER RPCs. Replace that pattern with a
-- transaction-local custom GUC that prevent_application_delete() honors, so BEFORE
-- DELETE may RETURN OLD only when privileged RPCs opt in.

create or replace function public.prevent_application_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('arakkis.allow_application_delete', true) = 'on' then
    return OLD;
  end if;
  raise exception 'application records are archived, not deleted' using errcode = '42501';
end;
$$;

comment on function public.prevent_application_delete() is
  'Blocks application DELETE unless transaction-local arakkis.allow_application_delete=on (lean/force delete RPCs).';

create or replace function public.phase3_delete_lean_event(
  p_event_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  actor_id uuid := auth.uid();
  event_row public.events%rowtype;
  canonical_reason text := btrim(coalesce(p_reason, ''));
  blocking_reason text;
begin
  if not public.is_active_system_admin() then
    raise exception 'event unavailable' using errcode = '42501';
  end if;
  if char_length(canonical_reason) = 0 then
    raise exception 'reason is required' using errcode = '22023';
  end if;
  if char_length(canonical_reason) > 500 then
    raise exception 'reason is too long' using errcode = '22023';
  end if;

  select * into event_row
  from public.events
  where id = p_event_id
  for update;
  if not found then
    raise exception 'event unavailable' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.registrations r where r.event_id = p_event_id) then
    blocking_reason := 'registrations';
  elsif exists (
    select 1 from public.registration_group_results g where g.event_id = p_event_id
  ) then
    blocking_reason := 'registration group results';
  elsif exists (
    select 1 from public.event_cancellations c where c.event_id = p_event_id
  ) then
    blocking_reason := 'cancellation history';
  elsif exists (
    select 1
    from public.event_cancellations c
    where c.replacement_event_id = p_event_id
  ) then
    blocking_reason := 'replacement-event references';
  elsif exists (
    select 1 from public.event_cancellation_requests r where r.event_id = p_event_id
  ) then
    blocking_reason := 'cancellation requests';
  elsif exists (
    select 1 from public.over_capacity_overrides o where o.event_id = p_event_id
  ) then
    blocking_reason := 'over-capacity overrides';
  elsif exists (
    select 1 from public.participant_notification_tasks t where t.event_id = p_event_id
  ) then
    blocking_reason := 'notification tasks';
  elsif exists (
    select 1 from public.follow_up_tasks t where t.event_id = p_event_id
  ) then
    blocking_reason := 'follow-up tasks';
  elsif exists (
    select 1 from public.group_chat_reminders g where g.event_id = p_event_id
  ) then
    blocking_reason := 'group chat reminders';
  elsif exists (
    select 1 from public.completed_event_invalidations i where i.event_id = p_event_id
  ) then
    blocking_reason := 'completed-event invalidations';
  elsif exists (
    select 1
    from public.participant_booking_audits a
    where a.source_event_id = p_event_id
       or a.target_event_id = p_event_id
  ) then
    blocking_reason := 'booking audits';
  end if;

  if blocking_reason is not null then
    raise exception
      'cannot permanently delete: this event has % — cancel and archive instead, or clear history first',
      blocking_reason
      using errcode = '22023';
  end if;

  insert into public.audit_events(
    actor_admin_id, action, entity_type, entity_id, reason, old_values, new_values
  ) values (
    actor_id,
    'EVENT_DELETED_LEAN',
    'events',
    p_event_id,
    canonical_reason,
    jsonb_build_object(
      'name', event_row.name,
      'status', event_row.status,
      'publication_status', event_row.publication_status,
      'starts_at', event_row.starts_at,
      'archived_at', event_row.archived_at,
      'event_series_id', event_row.event_series_id
    ),
    jsonb_build_object('deleted', true, 'mode', 'lean')
  );

  -- Hosted-safe bypass of *_no_delete / prevent_application_delete (not session_replication_role).
  perform set_config('arakkis.allow_application_delete', 'on', true);

  -- Ephemeral / setup-only children that do not represent durable operational history.
  delete from public.event_eligible_organizations where event_id = p_event_id;
  delete from public.design_assets where event_id = p_event_id;
  -- event_invite_links cascade on events delete; delete explicitly for clarity.
  delete from public.event_invite_links where event_id = p_event_id;

  delete from public.events where id = p_event_id;
end;
$function$;

revoke all on function public.phase3_delete_lean_event(uuid, text) from public;
grant execute on function public.phase3_delete_lean_event(uuid, text) to authenticated;

comment on function public.phase3_delete_lean_event(uuid, text) is
  'System Admin permanent delete of a lean Event with no durable history (DEC-074). Bypasses archive-not-delete triggers via arakkis.allow_application_delete after guards/audit.';

-- Same hosted failure path for force-delete; swap set_config only (guards/cascade unchanged).
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

  -- Hosted-safe bypass of *_no_delete / prevent_application_delete (not session_replication_role).
  perform set_config('arakkis.allow_application_delete', 'on', true);

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
  'System Admin force cascade delete of a participant and all history (DEC-071). Bypasses archive-not-delete triggers via arakkis.allow_application_delete. Prefer DEC-069 archive or DEC-070 lean delete when applicable.';
