-- Phase 1B schema assertions.
-- Run against a disposable database after applying all migrations:
--   psql "$DATABASE_URL" --single-transaction -f supabase/tests/phase-1-schema-assertions.sql

do $$
declare
  expected_tables constant text[] := array[
    'organizations','venues','admin_profiles','admin_invitations','admin_organization_assignments',
    'admin_invitation_organizations','events','participants','event_eligible_organizations',
    'acknowledgment_versions','acknowledgment_acceptances','registration_groups','registrations',
    'attendance','attendance_transitions','follow_up_tasks','confirmation_tokens',
    'event_cancellation_requests','event_cancellations','cancellation_template_versions',
    'participant_notification_tasks','participant_notification_deliveries','notification_delivery_transitions',
    'over_capacity_overrides','possible_duplicate_cases','participant_merges','participant_merge_conflicts',
    'participant_notes','completed_event_invalidations','audit_events'
  ];
  missing text;
  table_count integer;
begin
  select count(*) into table_count
  from information_schema.tables
  where table_schema = 'public' and table_name = any(expected_tables);
  if table_count <> cardinality(expected_tables) then
    select string_agg(t, ', ' order by t) into missing
    from unnest(expected_tables) t
    where to_regclass('public.' || t) is null;
    raise exception 'schema assertion failed: expected 30 tables, found %, missing %', table_count, missing;
  end if;

  if not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'register_selected_events') then
    raise exception 'schema assertion failed: anonymous registration RPC is missing';
  end if;
  if not exists (select 1 from pg_views where schemaname = 'public' and viewname = 'public_event_schedule') then
    raise exception 'schema assertion failed: public event schedule projection is missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'attendance_transition_recorder'
      and tgfoid = 'public.record_attendance_transition()'::regprocedure
  ) then
    raise exception 'schema assertion failed: attendance transition trigger is missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'notification_transition_recorder'
      and tgfoid = 'public.record_notification_transition()'::regprocedure
  ) then
    raise exception 'schema assertion failed: notification transition trigger is missing';
  end if;
end;
$$;

do $$
begin
  if has_table_privilege('anon', 'public.participants', 'SELECT') then
    raise exception 'security assertion failed: anon can select participants';
  end if;
  if has_table_privilege('anon', 'public.registrations', 'SELECT') then
    raise exception 'security assertion failed: anon can select registrations';
  end if;
  if has_table_privilege('anon', 'public.attendance', 'SELECT') then
    raise exception 'security assertion failed: anon can select attendance';
  end if;
  if not has_table_privilege('anon', 'public.public_event_schedule', 'SELECT') then
    raise exception 'security assertion failed: anon cannot select public schedule';
  end if;
  if has_function_privilege('anon', 'public.is_active_system_admin()', 'EXECUTE') then
    raise exception 'security assertion failed: anon can execute privileged helper';
  end if;
  if not has_function_privilege(
    'anon',
    'public.register_selected_events(text,text,text,text,text,text,text,uuid,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text)',
    'EXECUTE'
  ) then
    raise exception 'security assertion failed: anon cannot execute registration RPC';
  end if;
end;
$$;
