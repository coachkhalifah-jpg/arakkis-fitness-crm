-- Phase 1 / 0007: fail-closed RLS and the only anonymous read projection.
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','venues','admin_profiles','admin_invitations','admin_organization_assignments','admin_invitation_organizations','events','participants','event_eligible_organizations',
    'acknowledgment_versions','registration_groups','possible_duplicate_cases','registrations','attendance','attendance_transitions','follow_up_tasks','confirmation_tokens',
    'cancellation_template_versions','event_cancellation_requests','event_cancellations','participant_notification_tasks','participant_notification_deliveries','notification_delivery_transitions',
    'over_capacity_overrides','acknowledgment_acceptances','participant_merges','participant_merge_conflicts','participant_notes','audit_events','completed_event_invalidations'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_active_system_admin()) with check (public.is_active_system_admin())', 'system_admin_all_' || t, t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

create policy host_read_organizations on public.organizations for select to authenticated using (
  public.has_active_host_access(id)
  or exists (select 1 from public.events e where e.host_organization_id = organizations.id and public.has_event_access(e.id))
);
create policy host_read_venues on public.venues for select to authenticated using (
  exists (select 1 from public.events e where e.venue_id = venues.id and public.has_event_access(e.id))
);
create policy host_read_events on public.events for select to authenticated using (public.has_event_access(id));
create policy host_read_event_eligible_orgs on public.event_eligible_organizations for select to authenticated using (public.has_event_access(event_id));
create policy host_read_registrations on public.registrations for select to authenticated using (public.has_event_access(event_id));
create policy host_operate_registrations on public.registrations for insert to authenticated with check (public.has_event_access(event_id));
create policy host_update_registrations on public.registrations for update to authenticated using (public.has_event_access(event_id)) with check (public.has_event_access(event_id));
create policy host_read_attendance on public.attendance for select to authenticated using (exists (select 1 from public.registrations r where r.id = attendance.registration_id and public.has_event_access(r.event_id)));
create policy host_operate_attendance on public.attendance for insert to authenticated with check (exists (select 1 from public.registrations r where r.id = attendance.registration_id and public.has_event_access(r.event_id)));
create policy host_update_attendance on public.attendance for update to authenticated using (exists (select 1 from public.registrations r where r.id = attendance.registration_id and public.has_event_access(r.event_id))) with check (exists (select 1 from public.registrations r where r.id = attendance.registration_id and public.has_event_access(r.event_id)));
create policy host_read_attendance_transitions on public.attendance_transitions for select to authenticated using (exists (select 1 from public.attendance a join public.registrations r on r.id = a.registration_id where a.id = attendance_transitions.attendance_id and public.has_event_access(r.event_id)));
create policy host_read_participants on public.participants for select to authenticated using (exists (select 1 from public.registrations r where r.participant_id = participants.id and public.has_event_access(r.event_id)));
create policy host_read_groups on public.registration_groups for select to authenticated using (exists (select 1 from public.registrations r where r.registration_group_id = registration_groups.id and public.has_event_access(r.event_id)));
create policy host_read_overrides on public.over_capacity_overrides for select to authenticated using (public.has_event_access(event_id));
create policy host_read_cancellations on public.event_cancellations for select to authenticated using (public.has_event_access(event_id));
create policy host_read_cancel_requests on public.event_cancellation_requests for select to authenticated using (public.has_event_access(event_id));
create policy host_create_cancel_requests on public.event_cancellation_requests for insert to authenticated with check (public.has_event_access(event_id));
create policy host_update_cancel_requests on public.event_cancellation_requests for update to authenticated using (public.has_event_access(event_id)) with check (public.has_event_access(event_id));
create policy host_read_notification_tasks on public.participant_notification_tasks for select to authenticated using (public.has_event_access(event_id));
create policy host_read_notification_deliveries on public.participant_notification_deliveries for select to authenticated using (
  exists (select 1 from public.participant_notification_tasks t where t.id = participant_notification_deliveries.participant_notification_task_id and public.has_event_access(t.event_id))
);
create policy host_update_notification_deliveries on public.participant_notification_deliveries for update to authenticated using (
  exists (select 1 from public.participant_notification_tasks t where t.id = participant_notification_deliveries.participant_notification_task_id and public.has_event_access(t.event_id))
) with check (
  exists (select 1 from public.participant_notification_tasks t where t.id = participant_notification_deliveries.participant_notification_task_id and public.has_event_access(t.event_id))
);
create policy host_read_notification_transitions on public.notification_delivery_transitions for select to authenticated using (
  exists (select 1 from public.participant_notification_deliveries d join public.participant_notification_tasks t on t.id = d.participant_notification_task_id where d.id = notification_delivery_transitions.delivery_id and public.has_event_access(t.event_id))
);

create view public.public_event_schedule with (security_invoker = false) as
select e.id, e.name, e.description, e.participant_instructions, e.starts_at, e.ends_at, e.timezone, e.capacity,
       e.registration_deadline, e.visibility, e.host_organization_id, e.venue_id,
       o.name as host_organization_name, v.name as venue_name, v.city as venue_city, v.state as venue_state
from public.events e
join public.organizations o on o.id = e.host_organization_id
join public.venues v on v.id = e.venue_id
where e.status = 'OPEN' and e.starts_at > now() and e.registration_deadline >= now();
grant select on public.public_event_schedule to anon, authenticated;

comment on view public.public_event_schedule is 'Narrow anonymous schedule projection; registration and confirmation remain RPC-only.';
