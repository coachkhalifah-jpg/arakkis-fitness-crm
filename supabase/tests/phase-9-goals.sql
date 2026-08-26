-- Participant goals are nullable private profile data and are not exposed by
-- participant-facing operational projections.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'participants' and column_name = 'goals'
      and is_nullable = 'YES' and data_type = 'text'
  ) then
    raise exception 'participants.goals must be nullable text';
  end if;
  if not has_function_privilege(
    'anon',
    'public.register_selected_events_with_legal(text,text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[],uuid)',
    'EXECUTE'
  ) then
    raise exception 'goals registration RPC is not available to the browser role';
  end if;
  if has_table_privilege('anon', 'public.participants', 'SELECT') then
    raise exception 'participants must not be directly readable by anon';
  end if;
end $$;
