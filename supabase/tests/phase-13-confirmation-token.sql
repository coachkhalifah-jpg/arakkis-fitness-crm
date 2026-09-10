-- RC2-A registration-integrity assertions.
-- Run against a disposable database after applying all migrations.

do $$
declare
  function_definition text;
  confirmation_definition text;
  generated_token text;
  token_count integer;
begin
  select pg_get_functiondef(
    'public.register_selected_events_with_legal(text,text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[],uuid)'::regprocedure
  ) into function_definition;

  select pg_get_functiondef('public.get_registration_confirmation(text)'::regprocedure)
    into confirmation_definition;

  if position('translate(rtrim(encode(gen_random_bytes(32), ''base64''), ''=''), ''+/'', ''-_'')' in function_definition) = 0 then
    raise exception 'confirmation token producer is not URL-safe';
  end if;
  if position('insert into public.registration_group_results' in function_definition) = 0 then
    raise exception 'registration producer must persist confirmation lookup results';
  end if;

  token_count := 0;
  while token_count < 256 loop
    generated_token := translate(rtrim(encode(gen_random_bytes(32), 'base64'), '='), '+/', '-_');
    if generated_token !~ '^[A-Za-z0-9_-]{40,60}$' then
      raise exception 'generated confirmation token violates URL-safe contract';
    end if;
    token_count := token_count + 1;
  end loop;
end;
$$;

do $$
declare
  function_definition text;
  confirmation_definition text;
begin
  select pg_get_functiondef(
    'public.register_selected_events_with_legal(text,text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[],uuid)'::regprocedure
  ) into function_definition;
  select pg_get_functiondef('public.get_registration_confirmation(text)'::regprocedure)
    into confirmation_definition;

  if position('p_token !~ ''^[A-Za-z0-9_-]{40,60}$''' in confirmation_definition) = 0 then
    raise exception 'confirmation lookup no longer enforces the canonical token contract';
  end if;

  if position('p.status=''ACTIVE''' in function_definition) = 0 then
    raise exception 'registration matching must exclude non-active participants';
  end if;
  if position('normalize(p_first_name, NFKC)' in function_definition) = 0
     or position('normalize(p_last_name, NFKC)' in function_definition) = 0
     or position('regexp_replace(normalize(p_first_name, NFKC), ''[[:space:]]+'', '' '', ''g'')' in function_definition) = 0 then
    raise exception 'registration name normalization must match the application contract';
  end if;
end;
$$;
