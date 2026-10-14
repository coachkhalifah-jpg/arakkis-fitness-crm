-- DEC-062 / UAT-014: ACTIVE phone-only match attaches without creating a twin.
do $$
declare
  v_fn text;
begin
  select pg_get_functiondef('public.register_selected_events_with_legal(text,text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[],uuid)'::regprocedure)
    into v_fn;
  if v_fn is null or position('p.normalized_phone=p_normalized_phone' in v_fn) = 0 then
    raise exception 'register_selected_events_with_legal missing phone match';
  end if;
  if position('normalized_first_name=lower' in v_fn) > 0 then
    raise exception 'register_selected_events_with_legal still requires name in match predicate';
  end if;

  select pg_get_functiondef('public.phase5_create_walk_in(uuid,text,text,text,text,text,text,text,uuid,text,uuid,uuid,inet,text,text)'::regprocedure)
    into v_fn;
  if v_fn is null or position('p.normalized_phone = p_normalized_phone' in v_fn) = 0 then
    raise exception 'phase5_create_walk_in missing phone match';
  end if;
  if position('normalized_first_name = lower' in v_fn) > 0 then
    raise exception 'phase5_create_walk_in still requires name in match predicate';
  end if;
end $$;
