-- The legal wrapper is now the only browser-callable registration RPC.
-- Preserve the old implementations for controlled internal reuse, but remove
-- their anonymous/authenticated surface so approved production readiness cannot
-- be bypassed by omitting the current legal-document evidence.

alter function public.register_selected_events_with_referral(
  text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text
) rename to register_selected_events_with_referral_internal;

-- Keep the dependency target name available to existing definer functions,
-- while withholding all browser privileges from this compatibility shim.
create function public.register_selected_events_with_referral(
  p_first_name text, p_last_name text, p_display_phone text, p_normalized_phone text,
  p_phone_country text, p_email text, p_normalized_email text, p_fitness_experience text,
  p_event_ids uuid[], p_participation_acknowledgment_version_id uuid,
  p_data_use_acknowledgment_version_id uuid, p_participation_acknowledged_at timestamptz,
  p_data_use_acknowledged_at timestamptz, p_ip_address inet, p_user_agent text,
  p_idempotency_key text default null, p_referral_source text default null,
  p_referral_source_other_text text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  return public.register_selected_events_with_referral_internal(
    p_first_name, p_last_name, p_display_phone, p_normalized_phone, p_phone_country,
    p_email, p_normalized_email, p_fitness_experience, p_event_ids,
    p_participation_acknowledgment_version_id, p_data_use_acknowledgment_version_id,
    p_participation_acknowledged_at, p_data_use_acknowledged_at, p_ip_address,
    p_user_agent, p_idempotency_key, p_referral_source, p_referral_source_other_text
  );
end;
$$;
revoke all on function public.register_selected_events_with_referral(
  text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text
) from public, anon, authenticated;

revoke all on function public.register_selected_events_with_referral_internal(
  text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text
) from public, anon, authenticated;
revoke all on function public.register_selected_events(
  text,text,text,text,text,text,text,uuid,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text
) from public, anon, authenticated;

revoke all on function public.register_selected_events_with_legal(
  text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[]
) from public;
grant execute on function public.register_selected_events_with_legal(
  text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[]
) to anon, authenticated;
