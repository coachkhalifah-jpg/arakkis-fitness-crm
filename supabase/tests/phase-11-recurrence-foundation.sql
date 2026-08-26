-- Slice A schema/RLS assertions. Runtime backfill invariants are checked by the
-- migration transaction itself and by the repository recurrence foundation test.
do $$
declare
  expected_column text;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'event_series_schedule_rules'
  ) then
    raise exception 'schedule-rule table is missing';
  end if;

  foreach expected_column in array array[
    'event_series_id', 'weekday', 'local_start_time', 'local_end_time',
    'effective_start_date', 'effective_end_date', 'created_by_admin_id',
    'supersedes_rule_id'
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'event_series_schedule_rules'
        and information_schema.columns.column_name = expected_column
    ) then
      raise exception 'schedule-rule column % is missing', expected_column;
    end if;
  end loop;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'schedule_rule_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'generated_local_date'
  ) then
    raise exception 'event occurrence provenance columns are missing';
  end if;

  if has_table_privilege('anon', 'public.event_series_schedule_rules', 'SELECT') then
    raise exception 'anon must not read schedule-rule rows';
  end if;

  if has_table_privilege('authenticated', 'public.event_series_schedule_rules', 'DELETE') then
    raise exception 'authenticated users must not delete schedule-rule rows';
  end if;

  if not has_table_privilege('authenticated', 'public.event_series_schedule_rules', 'SELECT')
     or not has_table_privilege('authenticated', 'public.event_series_schedule_rules', 'INSERT')
     or not has_table_privilege('authenticated', 'public.event_series_schedule_rules', 'UPDATE') then
    raise exception 'authenticated schedule-rule privileges are incomplete';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'phase10_participant_selection_window_allows'
      and pg_get_functiondef(p.oid) like '%selection_window_days%'
  ) then
    raise exception 'participant selection-window guard is missing';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_public_event_by_slug_access'
      and pg_get_functiondef(p.oid) like '%selection_window_days%'
  ) then
    raise exception 'public recurring registration lookup is not bounded by selection window';
  end if;
end $$;
