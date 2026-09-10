-- RC2 cancelled Event archive boundary assertions.
-- Run against a disposable database after applying all migrations.

do $$
declare
  trigger_exists boolean;
  function_definition text;
begin
  select exists (
    select 1 from pg_trigger
    where tgrelid = 'public.events'::regclass
      and tgname = 'events_archive_guard'
  ) into trigger_exists;
  if not trigger_exists then
    raise exception 'cancelled Event archive trigger is missing';
  end if;

  select pg_get_functiondef('public.prevent_invalid_event_archive()'::regprocedure)
    into function_definition;
  if position('old.status <> ''CANCELLED''' in function_definition) = 0
     or position('is_active_system_admin()' in function_definition) = 0 then
    raise exception 'cancelled Event archive guard is not enforcing the approved boundary';
  end if;
end;
$$;
