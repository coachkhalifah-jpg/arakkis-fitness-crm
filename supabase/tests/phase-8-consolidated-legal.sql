-- Consolidated legal acceptance schema and fail-closed package checks.
select set_config('app.environment', 'test', false);
do $$
begin
  if to_regclass('public.legal_packages') is null
     or to_regclass('public.legal_package_components') is null
     or to_regclass('public.registration_legal_package_acceptances') is null then
    raise exception 'consolidated legal acceptance tables are missing';
  end if;
  if not has_function_privilege(
    'anon',
    'public.register_selected_events_with_legal(text,text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[],uuid)',
    'EXECUTE'
  ) then
    raise exception 'package registration RPC is not available to the browser role';
  end if;
  if has_table_privilege('anon', 'public.registration_legal_package_acceptances', 'SELECT') then
    raise exception 'package acceptance evidence must not be directly readable by anon';
  end if;
  if (select count(*) from public.legal_package_components where legal_package_id = '06400000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'pilot legal package must contain exactly one component';
  end if;
  if not public.legal_package_is_valid('06400000-0000-0000-0000-000000000001') then
    raise exception 'pilot legal package must be valid';
  end if;
end $$;
