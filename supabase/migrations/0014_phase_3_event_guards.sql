-- Phase 3: database guards for event ownership, lifecycle, and archival.
create or replace function public.enforce_event_phase_3_guards()
returns trigger
language plpgsql
set search_path = public, auth
as $$
begin
  if not exists (
    select 1 from public.venues v
    where v.id = new.venue_id
      and v.organization_id = new.host_organization_id
      and v.active_status <> 'ARCHIVED'
      and exists (select 1 from public.organizations o where o.id = v.organization_id and o.active_status <> 'ARCHIVED')
  ) then
    raise exception 'event venue must belong to an active organization' using errcode = '23514';
  end if;

  if new.status = 'OPEN' and (new.registration_deadline > new.starts_at or new.starts_at <= now()) then
    raise exception 'event cannot be opened with an invalid registration deadline or past start' using errcode = '22023';
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if old.status = 'CANCELLED' or old.status = 'COMPLETED' then
      raise exception 'event status cannot be restored or changed from its terminal state' using errcode = '42501';
    end if;
    if old.status = 'DRAFT' and new.status not in ('OPEN', 'CANCELLED') then
      raise exception 'invalid event lifecycle transition' using errcode = '22023';
    end if;
    if old.status = 'OPEN' and new.status not in ('CLOSED', 'CANCELLED') then
      raise exception 'invalid event lifecycle transition' using errcode = '22023';
    end if;
    if old.status = 'CLOSED' and new.status <> 'COMPLETED' then
      raise exception 'invalid event lifecycle transition' using errcode = '22023';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.status <> 'DRAFT' then
    if new.host_organization_id <> old.host_organization_id or new.venue_id <> old.venue_id
       or new.starts_at <> old.starts_at or new.ends_at <> old.ends_at
       or new.timezone <> old.timezone or new.capacity <> old.capacity
       or new.registration_deadline <> old.registration_deadline then
      raise exception 'published event scheduling and ownership fields are immutable' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists events_phase_3_guards on public.events;
create trigger events_phase_3_guards
before insert or update on public.events
for each row execute function public.enforce_event_phase_3_guards();

comment on function public.enforce_event_phase_3_guards() is 'Phase 3 event relationship, lifecycle, and published-field guards.';
