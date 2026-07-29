-- Phase 1D / 0012: enforce attendance state and active-registration capacity invariants.
create or replace function public.enforce_attendance_invariants()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  registration_row public.registrations%rowtype;
  event_row public.events%rowtype;
begin
  select r.* into registration_row from public.registrations r where r.id = new.registration_id;
  if not found then
    raise exception 'attendance registration does not exist';
  end if;
  select e.* into event_row from public.events e where e.id = registration_row.event_id;

  if registration_row.registration_status = 'CANCELLED'
     and new.status in ('ATTENDED', 'NO_SHOW') then
    raise exception 'cancelled registration cannot become attended or no-show' using errcode = '23514';
  end if;
  if event_row.status = 'CANCELLED' and new.status in ('ATTENDED', 'NO_SHOW') then
    raise exception 'cancelled event cannot create attended or no-show outcome' using errcode = '23514';
  end if;
  if new.status = 'ATTENDED'
     and event_row.attendance_processing_state not in ('OPEN', 'REOPENED', 'FINALIZED') then
    raise exception 'attendance can only be recorded while attendance processing is open or finalized for correction' using errcode = '23514';
  end if;
  if new.status = 'NO_SHOW'
     and event_row.attendance_processing_state <> 'FINALIZED' then
    raise exception 'no-show requires finalized attendance processing' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger attendance_invariants
before insert or update on public.attendance
for each row execute function public.enforce_attendance_invariants();

create or replace function public.enforce_active_registration_capacity()
returns trigger
language plpgsql
set search_path = public, auth
as $$
declare
  event_capacity integer;
  active_count integer;
begin
  if new.registration_status = 'REGISTERED' and new.registration_outcome = 'ACTIVE' then
    select e.capacity into event_capacity from public.events e where e.id = new.event_id for update;
    if event_capacity is null then
      raise exception 'registration event does not exist';
    end if;
    if new.over_capacity_override_id is null then
      select count(*) into active_count
      from public.registrations r
      where r.event_id = new.event_id
        and r.registration_status = 'REGISTERED'
        and r.registration_outcome = 'ACTIVE'
        and (tg_op = 'INSERT' or r.id <> new.id);
      if active_count >= event_capacity then
        raise exception 'event capacity exceeded' using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger registrations_capacity_guard
before insert or update on public.registrations
for each row execute function public.enforce_active_registration_capacity();
