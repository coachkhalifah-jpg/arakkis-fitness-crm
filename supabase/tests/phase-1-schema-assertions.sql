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
    'participant_notes','completed_event_invalidations','audit_events','event_series','design_assets'
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
    raise exception 'schema assertion failed: expected 31 tables, found %, missing %', table_count, missing;
  end if;

  if not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'register_selected_events') then
    raise exception 'schema assertion failed: anonymous registration RPC is missing';
  end if;
  if not exists (select 1 from pg_views where schemaname = 'public' and viewname = 'public_event_schedule') then
    raise exception 'schema assertion failed: public event schedule projection is missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'registrations' and column_name = 'referral_source'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'registrations' and column_name = 'referral_source_other_text'
  ) then
    raise exception 'schema assertion failed: registration referral fields are missing';
  end if;
  if not exists (
    select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'register_selected_events_with_referral'
  ) then
    raise exception 'schema assertion failed: referral registration RPC is missing';
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
  if not has_table_privilege('anon', 'public.design_assets', 'SELECT') then
    raise exception 'security assertion failed: anon cannot select design asset metadata';
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
  if not has_function_privilege(
    'anon',
    'public.register_selected_events_with_referral(text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'security assertion failed: anon cannot execute referral registration RPC';
  end if;
end;
$$;

do $$
declare
  expected_enums constant text[] := array[
    'organization_status','participant_status','admin_role','admin_status','event_status',
    'event_visibility','attendance_processing_state','submission_source','registration_status',
    'registration_outcome','attendance_status','follow_up_reason','follow_up_status',
    'notification_type','notification_task_status','notification_priority','delivery_status',
    'delivery_channel','cancellation_request_status','cancellation_type','cancellation_template_type',
    'template_status','acknowledgment_type','legal_status','invitation_status','duplicate_case_status',
    'merge_conflict_type','whatsapp_invitation_status','attendance_transition_source','override_source',
    'event_recurrence_frequency','registration_referral_source'
  ];
  missing text;
  enum_count integer;
begin
  select count(*) into enum_count
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typtype = 'e' and t.typname = any(expected_enums);
  if enum_count <> cardinality(expected_enums) then
    select string_agg(e, ', ' order by e) into missing
    from unnest(expected_enums) e
    where not exists (
      select 1 from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typtype = 'e' and t.typname = e
    );
    raise exception 'schema assertion failed: expected 30 enums, found %, missing %', enum_count, missing;
  end if;
end;
$$;

do $$
declare
  table_name text;
  expected_tables constant text[] := array[
    'organizations','venues','admin_profiles','admin_invitations','admin_organization_assignments',
    'admin_invitation_organizations','events','participants','event_eligible_organizations',
    'acknowledgment_versions','acknowledgment_acceptances','registration_groups','registrations',
    'attendance','attendance_transitions','follow_up_tasks','confirmation_tokens',
    'event_cancellation_requests','event_cancellations','cancellation_template_versions',
    'participant_notification_tasks','participant_notification_deliveries','notification_delivery_transitions',
    'over_capacity_overrides','possible_duplicate_cases','participant_merges','participant_merge_conflicts',
    'participant_notes','completed_event_invalidations','audit_events','event_series','design_assets'
  ];
begin
  foreach table_name in array expected_tables loop
    if not exists (
      select 1 from pg_constraint c
      where c.conrelid = ('public.' || table_name)::regclass and c.contype = 'p'
    ) then
      raise exception 'schema assertion failed: table % has no primary key', table_name;
    end if;
    if not exists (
      select 1 from pg_class r
      join pg_namespace n on n.oid = r.relnamespace
      where n.nspname = 'public' and r.relname = table_name and r.relrowsecurity
    ) then
      raise exception 'security assertion failed: RLS is not enabled on %', table_name;
    end if;
  end loop;

  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'registrations_active_unique_idx') then
    raise exception 'schema assertion failed: active registration partial index is missing';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'confirmation_tokens_one_active_idx') then
    raise exception 'schema assertion failed: active confirmation-token partial index is missing';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'cancellation_requests_one_pending_idx') then
    raise exception 'schema assertion failed: pending cancellation partial index is missing';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'admin_profiles_active_email_uq') then
    raise exception 'schema assertion failed: active admin email unique index is missing';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'design_assets_active_event_uq') then
    raise exception 'schema assertion failed: active event design asset index is missing';
  end if;
end;
$$;

do $$
declare
  required_policy text;
  required_policies constant text[] := array[
    'system_admin_all_events','system_admin_all_participants','host_read_events',
    'host_read_registrations','host_read_attendance','host_read_participants',
    'host_read_notification_tasks','host_update_notification_deliveries',
    'design_assets_public_read','design_assets_system_admin_all'
  ];
begin
  foreach required_policy in array required_policies loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = required_policy) then
      raise exception 'security assertion failed: required RLS policy % is missing', required_policy;
    end if;
  end loop;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'is_active_system_admin' and p.prosecdef) then
    raise exception 'security assertion failed: system-admin helper is missing or not security definer';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'has_event_access' and p.prosecdef) then
    raise exception 'security assertion failed: event-access helper is missing or not security definer';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'register_selected_events' and p.prosecdef) then
    raise exception 'security assertion failed: registration RPC is missing or not security definer';
  end if;
end;
$$;

do $$
declare
  immutable_table text;
  immutable_tables constant text[] := array[
    'acknowledgment_acceptances','attendance_transitions','notification_delivery_transitions',
    'event_cancellations','participant_merges','participant_merge_conflicts',
    'completed_event_invalidations','audit_events','over_capacity_overrides'
  ];
begin
  foreach immutable_table in array immutable_tables loop
    if not exists (select 1 from pg_trigger where tgrelid = ('public.' || immutable_table)::regclass and tgname = immutable_table || '_immutable') then
      raise exception 'immutability assertion failed: % immutable trigger is missing', immutable_table;
    end if;
  end loop;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.organizations'::regclass and tgname = 'organizations_no_delete') then
    raise exception 'archival assertion failed: organizations delete protection is missing';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.events'::regclass and tgname = 'events_capacity_guard') then
    raise exception 'constraint assertion failed: event capacity guard is missing';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.admin_profiles'::regclass and tgname = 'admin_profiles_active_host_assignment_guard') then
    raise exception 'authorization assertion failed: active Host Admin assignment guard is missing';
  end if;
end;
$$;
