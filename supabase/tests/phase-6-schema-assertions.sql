-- Phase 6 schema/security assertions.
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'attendance_follow_up_reconciliation') then raise exception 'attendance follow-up trigger missing'; end if;
  if not exists (select 1 from pg_constraint where conname = 'follow_up_completion_outcome_allowed') then raise exception 'completion outcome constraint missing'; end if;
  if not has_function_privilege('anon', 'public.phase6_search_participants(text,integer)', 'EXECUTE') then null; else raise exception 'anonymous participant search leaked'; end if;
  if not has_function_privilege('authenticated', 'public.phase6_complete_follow_up_task(uuid,text,text)', 'EXECUTE') then raise exception 'authenticated task completion grant missing'; end if;
  if has_table_privilege('authenticated', 'public.follow_up_tasks', 'INSERT') or has_table_privilege('authenticated', 'public.follow_up_tasks', 'UPDATE') then raise exception 'direct follow-up writes bypass lifecycle'; end if;
  if exists (select 1 from pg_policies where tablename = 'follow_up_tasks' and policyname like 'host_%') then raise exception 'Host Admin follow-up policy leaked'; end if;
end $$;
