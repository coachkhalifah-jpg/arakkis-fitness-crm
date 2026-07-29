-- Phase 7: fail-closed legal gate around the existing registration transaction.
-- The unchecked function remains private to the wrapper and never receives public execute.

create or replace function public.phase7_registration_legal_allowed()
returns boolean language sql stable security definer set search_path = public as $$
  select case coalesce(current_setting('app.environment', true), 'development')
    when 'development' then true
    when 'test' then true
    when 'staging' then coalesce(current_setting('app.synthetic_data', true), 'false') = 'true'
    when 'production' then coalesce(current_setting('app.legal_readiness', true), 'PROVISIONAL') = 'APPROVED'
    else false
  end;
$$;
revoke all on function public.phase7_registration_legal_allowed() from public, anon, authenticated;
grant execute on function public.phase7_registration_legal_allowed() to anon, authenticated, service_role;

alter function public.register_selected_events(text,text,text,text,text,text,text,uuid,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text)
  rename to register_selected_events_unchecked;

create or replace function public.register_selected_events(
  p_first_name text, p_last_name text, p_display_phone text, p_normalized_phone text, p_phone_country text,
  p_email text, p_normalized_email text, p_primary_affiliation_organization_id uuid, p_affiliation_other_text text,
  p_fitness_experience text, p_event_ids uuid[], p_participation_acknowledgment_version_id uuid,
  p_data_use_acknowledgment_version_id uuid, p_participation_acknowledged_at timestamptz,
  p_data_use_acknowledged_at timestamptz, p_ip_address inet, p_user_agent text, p_idempotency_key text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.phase7_registration_legal_allowed() then
    raise exception 'registration is not legally available' using errcode = '42501';
  end if;
  return public.register_selected_events_unchecked(
    p_first_name, p_last_name, p_display_phone, p_normalized_phone, p_phone_country,
    p_email, p_normalized_email, p_primary_affiliation_organization_id, p_affiliation_other_text,
    p_fitness_experience, p_event_ids, p_participation_acknowledgment_version_id,
    p_data_use_acknowledgment_version_id, p_participation_acknowledged_at,
    p_data_use_acknowledged_at, p_ip_address, p_user_agent, p_idempotency_key
  );
end; $$;
revoke all on function public.register_selected_events_unchecked(text,text,text,text,text,text,text,uuid,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text) from public, anon, authenticated;
revoke all on function public.register_selected_events(text,text,text,text,text,text,text,uuid,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text) from public, anon, authenticated;
grant execute on function public.register_selected_events(text,text,text,text,text,text,text,uuid,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text) to anon, authenticated;
