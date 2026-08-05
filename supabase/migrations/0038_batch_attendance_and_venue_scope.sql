-- Phase 5/3 corrections: transactional batch attendance and organization-scoped venues.

create or replace function public.phase5_save_attendance_changes(
  p_event_id uuid,
  p_changes jsonb
)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  change jsonb;
  registration_id uuid;
  status public.attendance_status;
  reason text;
  changed integer := 0;
  e public.events%rowtype;
begin
  e := public.phase5_require_event(p_event_id);
  if e.attendance_processing_state not in ('OPEN', 'REOPENED', 'FINALIZED') then
    raise exception 'attendance is not open' using errcode = '42501';
  end if;
  if e.attendance_processing_state = 'FINALIZED' and not public.is_active_system_admin() then
    raise exception 'attendance finalized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_changes) <> 'array' then
    raise exception 'attendance changes are invalid' using errcode = '22023';
  end if;
  for change in select value from jsonb_array_elements(p_changes)
  loop
    registration_id := (change->>'registration_id')::uuid;
    status := (change->>'status')::public.attendance_status;
    reason := nullif(btrim(change->>'reason'), '');
    if not exists (
      select 1 from public.registrations
      where id = registration_id and event_id = p_event_id
    ) then
      raise exception 'registration unavailable' using errcode = '42501';
    end if;
    perform public.phase5_mark_attendance(registration_id, status, reason);
    changed := changed + 1;
  end loop;
  return jsonb_build_object('changed', changed);
end;
$$;

revoke all on function public.phase5_save_attendance_changes(uuid,jsonb) from public;
grant execute on function public.phase5_save_attendance_changes(uuid,jsonb) to authenticated;

create policy host_read_assigned_venues on public.venues
for select to authenticated
using (public.has_active_host_access(organization_id));

create policy host_create_assigned_venues on public.venues
for insert to authenticated
with check (public.has_active_host_access(organization_id));

create policy host_update_assigned_venues on public.venues
for update to authenticated
using (public.has_active_host_access(organization_id))
with check (public.has_active_host_access(organization_id));

create or replace function public.prevent_host_venue_transfer()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_active_system_admin() and new.organization_id is distinct from old.organization_id then
    raise exception 'Host Admin cannot transfer a venue between organizations' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists venues_host_transfer_guard on public.venues;
create trigger venues_host_transfer_guard
before update on public.venues
for each row execute function public.prevent_host_venue_transfer();

revoke all on function public.prevent_host_venue_transfer() from public;
