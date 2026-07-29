-- Phase 5 database assertions. Run after migrations 0001-0017 on the local database.
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'phase5_open_attendance' and pronamespace = 'public'::regnamespace) then raise exception 'Phase 5 open-attendance RPC is missing'; end if;
  if not exists (select 1 from pg_proc where proname = 'phase5_finalize_attendance' and pronamespace = 'public'::regnamespace) then raise exception 'Phase 5 finalization RPC is missing'; end if;
  if has_function_privilege('anon', 'public.phase5_open_attendance(uuid)', 'EXECUTE') then raise exception 'anonymous execution must be denied'; end if;
  if not has_function_privilege('authenticated', 'public.phase5_create_walk_in(uuid,text,text,text,text,text,text,text,uuid,text,uuid,uuid,inet,text,text)', 'EXECUTE') then raise exception 'authenticated walk-in execution must be granted'; end if;
  if not exists (select 1 from pg_constraint where conname = 'registrations_override_fk' and condeferrable and condeferred) then raise exception 'capacity override relationship must be deferred for atomic walk-ins'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'attendance_transition_recorder') then raise exception 'attendance transition recorder is missing'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'registration_id_default') then raise exception 'walk-in registration id guard is missing'; end if;
  if not exists (select 1 from pg_proc where proname = 'phase5_create_walk_in' and proargnames @> array['p_event_id','p_over_capacity_reason']) then raise exception 'Phase 5 walk-in RPC replacement is missing'; end if;
end $$;
