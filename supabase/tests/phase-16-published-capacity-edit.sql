-- Published capacity edit: enforce_event_phase_3_guards must not lock capacity.
-- Run after migrations including 0087.

do $$
declare
  definition text;
begin
  select pg_get_functiondef(p.oid)
    into definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'enforce_event_phase_3_guards'
   limit 1;

  if definition is null then
    raise exception 'published capacity assertion failed: enforce_event_phase_3_guards missing';
  end if;

  if definition ilike '%new.capacity%old.capacity%'
     or definition ilike '%new.capacity is distinct from old.capacity%' then
    raise exception 'published capacity assertion failed: capacity still immutable in phase 3 guards';
  end if;

  if definition not ilike '%registration_deadline%' then
    raise exception 'published capacity assertion failed: schedule immutability missing';
  end if;
end $$;
