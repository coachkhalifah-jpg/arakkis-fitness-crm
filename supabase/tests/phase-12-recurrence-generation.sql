-- Slice B structural/security assertions. Dynamic generation and mutation
-- cases are exercised in the transactional SQL harness used for local QA.
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'phase3_add_schedule_rule'
  ) then raise exception 'add schedule rule RPC is missing'; end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'phase3_change_schedule_rule'
  ) then raise exception 'change schedule rule RPC is missing'; end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'phase3_stop_schedule_rule'
  ) then raise exception 'stop schedule rule RPC is missing'; end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'phase3_extend_series_end_date'
  ) then raise exception 'extend series end date RPC is missing'; end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'events_schedule_rule_generated_date_uq'
  ) then raise exception 'schedule rule/date uniqueness protection is missing'; end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_series_schedule_rules'
      and policyname = 'system_admin_all_event_series_schedule_rules'
  ) then raise exception 'System Admin schedule-rule policy is missing'; end if;
end $$;
