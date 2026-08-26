-- Focused catalog assertions for Slice A.
-- Run after the complete local migration replay.

do $$
declare
  venue_org_nullable boolean;
  event_trigger_definition text;
  event_rpc_definition text;
  public_view_definition text;
begin
  select is_nullable = 'YES'
    into venue_org_nullable
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'venues'
     and column_name = 'organization_id';
  if not venue_org_nullable then
    raise exception 'independent Venue assertion failed: venues.organization_id is not nullable';
  end if;

  select pg_get_functiondef(p.oid)
    into event_trigger_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'enforce_event_phase_3_guards'
   limit 1;
  if event_trigger_definition is null
     or event_trigger_definition not ilike '%organization_id is null%' then
    raise exception 'independent Venue assertion failed: Event trigger still requires Organization ownership';
  end if;

  select pg_get_functiondef(p.oid)
    into event_rpc_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'phase3_create_event_bundle'
   limit 1;
  if event_rpc_definition is null
     or event_rpc_definition not ilike '%organization_id is null%' then
    raise exception 'independent Venue assertion failed: atomic Event RPC still requires Organization ownership';
  end if;

  select pg_get_viewdef('public.public_event_schedule'::regclass, true)
    into public_view_definition;
  if public_view_definition is null
     or public_view_definition not ilike '%join venues%'
     or public_view_definition not ilike '%active_status%' then
    raise exception 'independent Venue assertion failed: public Event projection is incomplete';
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'venues'
       and policyname = 'host_read_venues'
  ) then
    raise exception 'independent Venue assertion failed: Host Event-scoped Venue read policy is missing';
  end if;
end $$;
