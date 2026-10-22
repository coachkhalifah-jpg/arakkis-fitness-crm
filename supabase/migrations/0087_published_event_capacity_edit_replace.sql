-- Idempotent hard replace: published Events may change capacity (DEC-009 / FR-005).
-- 0085 used string-replace on pg_get_functiondef and can no-op if formatting drifts.
-- Schedule / venue / ownership remain immutable after DRAFT; floor stays enforce_event_capacity().

create or replace function public.enforce_event_phase_3_guards()
returns trigger
language plpgsql
set search_path = public, auth
as $$
begin
  if not exists (
    select 1 from public.venues v
    where v.id = new.venue_id
      and (v.organization_id = new.host_organization_id or v.organization_id is null)
      and v.active_status <> 'ARCHIVED'
      and exists (
        select 1 from public.organizations o
        where o.id = new.host_organization_id
          and o.active_status <> 'ARCHIVED'
      )
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
    if new.host_organization_id is distinct from old.host_organization_id
       or new.venue_id is distinct from old.venue_id
       or new.starts_at is distinct from old.starts_at
       or new.ends_at is distinct from old.ends_at
       or new.timezone is distinct from old.timezone
       or new.registration_deadline is distinct from old.registration_deadline then
      raise exception 'published event scheduling and ownership fields are immutable' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_event_phase_3_guards() is
  'Phase 3 event relationship, lifecycle, and published-field guards. Capacity may change after publish; floor is enforce_event_capacity().';
