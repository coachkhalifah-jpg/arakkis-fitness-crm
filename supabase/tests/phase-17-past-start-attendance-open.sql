-- Past-start attendance open: past-start/deadline gate only on lifecycle → OPEN.
do $$
declare
  def text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'enforce_event_phase_3_guards';

  if def is null then
    raise exception 'past-start attendance assertion failed: enforce_event_phase_3_guards missing';
  end if;

  if position('tg_op = ''INSERT''' in def) = 0 then
    raise exception 'past-start attendance assertion failed: INSERT transition gate missing';
  end if;

  if position('old.status is distinct from new.status' in def) = 0 then
    raise exception 'past-start attendance assertion failed: status-transition gate missing';
  end if;

  if position('event cannot be opened with an invalid registration deadline or past start' in def) = 0 then
    raise exception 'past-start attendance assertion failed: publish past-start exception missing';
  end if;
end;
$$;
