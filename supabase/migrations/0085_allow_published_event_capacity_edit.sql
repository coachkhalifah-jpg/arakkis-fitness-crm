-- Allow System Admin capacity edits on non-DRAFT events (DEC-009 / FR-005 / AT-008).
-- Floor remains enforce_event_capacity(); schedule/ownership fields stay immutable after publish.
-- Capacity was previously bundled into "published event scheduling and ownership fields are immutable".

do $$
declare
  definition text;
  updated_definition text;
begin
  select pg_get_functiondef(p.oid)
    into definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'enforce_event_phase_3_guards'
   limit 1;

  if definition is null then
    raise exception '0085: enforce_event_phase_3_guards not found';
  end if;

  updated_definition := definition;
  -- Multi-line form from migration 0014 / current tip.
  updated_definition := replace(
    updated_definition,
    'or new.timezone <> old.timezone or new.capacity <> old.capacity
       or new.registration_deadline <> old.registration_deadline',
    'or new.timezone <> old.timezone
       or new.registration_deadline <> old.registration_deadline'
  );
  -- Compact / reformatted variants.
  updated_definition := replace(
    updated_definition,
    'or new.timezone <> old.timezone or new.capacity <> old.capacity or new.registration_deadline <> old.registration_deadline',
    'or new.timezone <> old.timezone or new.registration_deadline <> old.registration_deadline'
  );
  updated_definition := replace(
    updated_definition,
    'or new.capacity <> old.capacity
       or new.registration_deadline',
    'or new.registration_deadline'
  );

  if updated_definition = definition then
    if definition ilike '%new.capacity <> old.capacity%' then
      raise exception '0085: could not remove capacity from enforce_event_phase_3_guards immutability check';
    end if;
    -- Already applied / capacity already excluded.
    return;
  end if;

  if updated_definition ilike '%new.capacity <> old.capacity%' then
    raise exception '0085: capacity immutability clause still present after rewrite';
  end if;

  execute updated_definition;
end $$;

comment on function public.enforce_event_phase_3_guards() is
  'Phase 3 event relationship, lifecycle, and published-field guards. Capacity may change after publish; floor is enforce_event_capacity().';
