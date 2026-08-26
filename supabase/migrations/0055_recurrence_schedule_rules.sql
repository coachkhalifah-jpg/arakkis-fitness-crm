-- Slice A: recurrence data foundation.
-- This migration stores schedule provenance without changing the existing
-- materialized occurrence generation path. Slice B may begin using these rows.

create table public.event_series_schedule_rules (
  id uuid primary key default gen_random_uuid(),
  event_series_id uuid not null references public.event_series(id) on delete restrict,
  weekday smallint not null,
  local_start_time time without time zone not null,
  local_end_time time without time zone not null,
  effective_start_date date not null,
  effective_end_date date,
  created_by_admin_id uuid not null references public.admin_profiles(id) on delete restrict,
  supersedes_rule_id uuid references public.event_series_schedule_rules(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_series_schedule_rules_weekday_check check (weekday between 1 and 7),
  constraint event_series_schedule_rules_time_order_check check (local_end_time > local_start_time),
  constraint event_series_schedule_rules_date_order_check check (
    effective_end_date is null or effective_start_date <= effective_end_date
  ),
  constraint event_series_schedule_rules_series_id_uq unique (event_series_id, id)
);

create unique index event_series_schedule_rules_definition_uq
  on public.event_series_schedule_rules (
    event_series_id,
    weekday,
    local_start_time,
    local_end_time,
    effective_start_date,
    coalesce(effective_end_date, '9999-12-31'::date)
  );
create index event_series_schedule_rules_series_idx
  on public.event_series_schedule_rules (event_series_id, effective_start_date, effective_end_date);

alter table public.events
  add column if not exists schedule_rule_id uuid,
  add column if not exists generated_local_date date;

alter table public.events
  add constraint events_schedule_rule_series_check check (
    schedule_rule_id is null or event_series_id is not null
  ),
  add constraint events_generated_local_date_check check (
    generated_local_date is null or schedule_rule_id is not null
  );

alter table public.events
  add constraint events_schedule_rule_fk
  foreign key (event_series_id, schedule_rule_id)
  references public.event_series_schedule_rules (event_series_id, id)
  on delete restrict;

create unique index events_schedule_rule_generated_date_uq
  on public.events (schedule_rule_id, generated_local_date)
  where schedule_rule_id is not null and generated_local_date is not null;
create index events_schedule_rule_idx on public.events (schedule_rule_id, generated_local_date);

create trigger event_series_schedule_rules_updated_at
before update on public.event_series_schedule_rules
for each row execute function public.set_updated_at();
create trigger event_series_schedule_rules_no_delete
before delete on public.event_series_schedule_rules
for each row execute function public.prevent_application_delete();

create or replace function public.validate_event_series_schedule_rule()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  series_ends_on date;
  superseded_series_id uuid;
begin
  select ends_on into series_ends_on
  from public.event_series
  where id = new.event_series_id;

  if not found then
    raise exception 'schedule rule series is invalid' using errcode = '23503';
  end if;

  if new.effective_start_date > series_ends_on
     or (new.effective_end_date is not null and new.effective_end_date > series_ends_on) then
    raise exception 'schedule rule dates cannot exceed the series end date' using errcode = '22023';
  end if;

  if new.supersedes_rule_id is not null then
    select event_series_id into superseded_series_id
    from public.event_series_schedule_rules
    where id = new.supersedes_rule_id;
    if not found or superseded_series_id <> new.event_series_id then
      raise exception 'superseded schedule rule must belong to the same series' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

create trigger event_series_schedule_rules_validate
before insert or update on public.event_series_schedule_rules
for each row execute function public.validate_event_series_schedule_rule();

-- These action names are the audit contract for the later rule-management slice.
-- Backfilled rows intentionally have no actor audit row: they are migration evidence,
-- not an Admin mutation. Historical rule rows and occurrences remain undeletable.
create or replace function public.audit_event_series_schedule_rule_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor uuid;
  action_name text;
begin
  select id into actor
  from public.admin_profiles
  where id = auth.uid() and status = 'ACTIVE';

  if actor is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    action_name := 'SCHEDULE_RULE_CREATED';
    insert into public.audit_events (
      actor_admin_id, action, entity_type, entity_id, new_values
    ) values (
      actor, action_name, 'EVENT_SERIES_SCHEDULE_RULE', new.id, to_jsonb(new)
    );
    return new;
  end if;

  action_name := case
    when old.effective_end_date is null and new.effective_end_date is not null
      then 'SCHEDULE_RULE_STOPPED'
    else 'SCHEDULE_RULE_CHANGED'
  end;
  insert into public.audit_events (
    actor_admin_id, action, entity_type, entity_id, old_values, new_values
  ) values (
    actor, action_name, 'EVENT_SERIES_SCHEDULE_RULE', new.id, to_jsonb(old), to_jsonb(new)
  );
  return new;
end;
$$;

create trigger event_series_schedule_rules_audit
after insert or update on public.event_series_schedule_rules
for each row execute function public.audit_event_series_schedule_rule_change();

alter table public.event_series_schedule_rules enable row level security;
create policy system_admin_all_event_series_schedule_rules
  on public.event_series_schedule_rules for all to authenticated
  using (public.is_active_system_admin())
  with check (public.is_active_system_admin());
create policy host_read_event_series_schedule_rules
  on public.event_series_schedule_rules for select to authenticated
  using (
    exists (
      select 1
      from public.events e
      where e.event_series_id = event_series_schedule_rules.event_series_id
        and public.has_event_access(e.id)
    )
  );

grant select, insert, update on public.event_series_schedule_rules to authenticated;
revoke delete on public.event_series_schedule_rules from authenticated;

-- Backfill provenance without rewriting any occurrence identity or business data.
-- If the legacy rows do not describe one weekly local schedule, fail closed rather
-- than inventing a rule that would misrepresent existing occurrences.
do $$
declare
  series_row record;
  first_occurrence record;
  rule_id uuid;
begin
  for series_row in
    select s.id, s.ends_on, s.created_by_admin_id
    from public.event_series s
    order by s.created_at, s.id
  loop
    select
      e.id,
      (e.starts_at at time zone e.timezone)::date as local_date,
      extract(isodow from (e.starts_at at time zone e.timezone))::smallint as weekday,
      (e.starts_at at time zone e.timezone)::time as local_start_time,
      (e.ends_at at time zone e.timezone)::time as local_end_time
    into first_occurrence
    from public.events e
    where e.event_series_id = series_row.id
    order by e.starts_at, e.id
    limit 1;

    if not found then
      raise exception 'recurring series % has no occurrence to backfill', series_row.id
        using errcode = '22023';
    end if;

    if first_occurrence.local_date > series_row.ends_on then
      raise exception 'recurring series % has an occurrence after its end date', series_row.id
        using errcode = '22023';
    end if;

    if exists (
      select 1
      from public.events e
      where e.event_series_id = series_row.id
        and (
          extract(isodow from (e.starts_at at time zone e.timezone))::smallint <> first_occurrence.weekday
          or (e.starts_at at time zone e.timezone)::time <> first_occurrence.local_start_time
          or (e.ends_at at time zone e.timezone)::time <> first_occurrence.local_end_time
          or (e.ends_at at time zone e.timezone)::time <= (e.starts_at at time zone e.timezone)::time
          or (e.starts_at at time zone e.timezone)::date > series_row.ends_on
        )
    ) then
      raise exception 'recurring series % does not have one valid weekly local schedule', series_row.id
        using errcode = '22023';
    end if;

    insert into public.event_series_schedule_rules (
      event_series_id,
      weekday,
      local_start_time,
      local_end_time,
      effective_start_date,
      effective_end_date,
      created_by_admin_id
    ) values (
      series_row.id,
      first_occurrence.weekday,
      first_occurrence.local_start_time,
      first_occurrence.local_end_time,
      first_occurrence.local_date,
      series_row.ends_on,
      series_row.created_by_admin_id
    ) returning id into rule_id;

    update public.events e
    set schedule_rule_id = rule_id,
        generated_local_date = (e.starts_at at time zone e.timezone)::date
    where e.event_series_id = series_row.id;
  end loop;
end;
$$;

comment on table public.event_series_schedule_rules is
  'System Admin-controlled weekly schedule provenance for event_series; historical rows are retained.';
comment on column public.event_series_schedule_rules.weekday is
  'ISO weekday: Monday=1 through Sunday=7.';
comment on column public.events.schedule_rule_id is
  'Nullable provenance link for occurrences generated from a schedule rule; existing generation remains compatible.';
comment on column public.events.generated_local_date is
  'Persisted local date key used for future idempotent occurrence generation; distinct from starts_at.';
