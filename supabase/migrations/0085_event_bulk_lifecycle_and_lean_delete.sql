-- 0085 — DEC-073 / DEC-074
-- DEC-073: System Admin may bulk-cancel and bulk-archive-cancelled Events from discovery
--          (app-layer loops existing cancel/archive semantics; this migration documents
--           and adds lean hard-delete).
-- DEC-074: System Admin may permanently delete a lean Event with no durable history.

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
  'System Admin permanent delete of a lean Event with no durable history (DEC-074).';
