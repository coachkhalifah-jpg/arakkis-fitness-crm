-- Phase 4 schema/security assertions. Run against a clean local database.
do $$
begin
  if not exists (select 1 from pg_class where relname = 'registration_group_results' and relnamespace = 'public'::regnamespace) then raise exception 'Phase 4 result table is missing'; end if;
  if not exists (select 1 from pg_proc where proname = 'get_registration_confirmation' and pronamespace = 'public'::regnamespace) then raise exception 'Phase 4 confirmation function is missing'; end if;
  if not exists (select 1 from pg_proc where proname = 'get_public_registration_config' and pronamespace = 'public'::regnamespace) then raise exception 'Phase 4 public config function is missing'; end if;
  if has_table_privilege('anon', 'public.participants', 'SELECT') or has_table_privilege('anon', 'public.registrations', 'SELECT') then raise exception 'anonymous direct participant/registration reads are allowed'; end if;
  if not has_function_privilege('anon', 'public.get_registration_confirmation(text)', 'EXECUTE') then raise exception 'anonymous confirmation execution is missing'; end if;
  if not has_function_privilege('anon', 'public.register_selected_events(text,text,text,text,text,text,text,uuid,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text)', 'EXECUTE') then raise exception 'anonymous registration execution is missing'; end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'registration_group_results_event_uq') then raise exception 'registration result uniqueness is missing'; end if;
end;
$$;
