-- DEC-054: optional registration-level referral source.
-- The public booking form no longer accepts participant affiliation input.
-- Existing participant affiliation is resolved inside the guarded RPC and is never
-- replaced with the event host organization.

create type public.registration_referral_source as enum (
  'FRIEND_OR_FAMILY',
  'WHATSAPP_OR_GROUP_CHAT',
  'INSTAGRAM_OR_SOCIAL_MEDIA',
  'FLYER_OR_QR_CODE',
  'VENUE_ANNOUNCEMENT',
  'PREVIOUS_CLASS',
  'OTHER'
);

alter table public.registrations
  add column referral_source public.registration_referral_source,
  add column referral_source_other_text text;

alter table public.registrations
  add constraint registrations_referral_other_length_check
    check (referral_source_other_text is null or char_length(btrim(referral_source_other_text)) between 1 and 200),
  add constraint registrations_referral_other_only_check
    check (referral_source = 'OTHER' or referral_source_other_text is null);

create or replace function public.register_selected_events_with_referral(
  p_first_name text, p_last_name text, p_display_phone text, p_normalized_phone text, p_phone_country text,
  p_email text, p_normalized_email text, p_fitness_experience text, p_event_ids uuid[],
  p_participation_acknowledgment_version_id uuid, p_data_use_acknowledgment_version_id uuid,
  p_participation_acknowledged_at timestamptz, p_data_use_acknowledged_at timestamptz,
  p_ip_address inet, p_user_agent text, p_idempotency_key text default null,
  p_referral_source text default null, p_referral_source_other_text text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_participant_affiliation uuid;
  v_participant_affiliation_other text;
  v_exact_match_count integer;
  v_group_id uuid;
  v_result jsonb;
begin
  if p_referral_source is not null and p_referral_source not in (
    'FRIEND_OR_FAMILY', 'WHATSAPP_OR_GROUP_CHAT', 'INSTAGRAM_OR_SOCIAL_MEDIA',
    'FLYER_OR_QR_CODE', 'VENUE_ANNOUNCEMENT', 'PREVIOUS_CLASS', 'OTHER'
  ) then
    raise exception 'invalid referral source' using errcode = '22023';
  end if;
  if p_referral_source_other_text is not null
     and char_length(btrim(p_referral_source_other_text)) not between 1 and 200 then
    raise exception 'invalid referral source detail' using errcode = '22023';
  end if;
  if p_referral_source is distinct from 'OTHER'
     and nullif(btrim(p_referral_source_other_text), '') is not null then
    raise exception 'referral detail requires Other' using errcode = '22023';
  end if;
  if not public.phase7_registration_legal_allowed() then
    raise exception 'registration is not legally available' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_normalized_phone || '|' || lower(btrim(p_first_name)) || '|' || lower(btrim(p_last_name)), 4096
  ));
  select count(*) into v_exact_match_count
    from public.participants p
   where p.status = 'ACTIVE'
     and p.normalized_phone = p_normalized_phone
     and p.normalized_first_name = lower(btrim(p_first_name))
     and p.normalized_last_name = lower(btrim(p_last_name));
  if v_exact_match_count > 1 then
    raise exception 'ambiguous participant match' using errcode = '23514';
  end if;
  if v_exact_match_count = 1 then
    select p.primary_affiliation_organization_id, p.affiliation_other_text
      into v_participant_affiliation, v_participant_affiliation_other
      from public.participants p
     where p.status = 'ACTIVE'
       and p.normalized_phone = p_normalized_phone
       and p.normalized_first_name = lower(btrim(p_first_name))
       and p.normalized_last_name = lower(btrim(p_last_name));
  end if;

  v_result := public.register_selected_events_unchecked(
    p_first_name, p_last_name, p_display_phone, p_normalized_phone, p_phone_country,
    p_email, p_normalized_email, v_participant_affiliation, v_participant_affiliation_other,
    p_fitness_experience, p_event_ids, p_participation_acknowledgment_version_id,
    p_data_use_acknowledgment_version_id, p_participation_acknowledged_at,
    p_data_use_acknowledged_at, p_ip_address, p_user_agent, p_idempotency_key
  );

  v_group_id := nullif(v_result->>'registration_group_id', '')::uuid;
  if v_group_id is not null and p_referral_source is not null then
    update public.registrations
       set referral_source = p_referral_source::public.registration_referral_source,
           referral_source_other_text = case when p_referral_source = 'OTHER'
             then nullif(btrim(p_referral_source_other_text), '') else null end
     where registration_group_id = v_group_id;
  end if;
  return v_result;
end;
$$;

-- Preserve the legacy RPC contract for existing integrations, but ignore the
-- browser-supplied affiliation values and use the same server-derived behavior.
create or replace function public.register_selected_events(
  p_first_name text, p_last_name text, p_display_phone text, p_normalized_phone text, p_phone_country text,
  p_email text, p_normalized_email text, p_primary_affiliation_organization_id uuid, p_affiliation_other_text text,
  p_fitness_experience text, p_event_ids uuid[], p_participation_acknowledgment_version_id uuid,
  p_data_use_acknowledgment_version_id uuid, p_participation_acknowledged_at timestamptz,
  p_data_use_acknowledged_at timestamptz,
  p_ip_address inet, p_user_agent text,
  p_idempotency_key text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  -- Keep the legacy signature callable without allowing browser-supplied
  -- affiliation values to influence the new server-derived flow.
  perform p_primary_affiliation_organization_id;
  perform p_affiliation_other_text;
  return public.register_selected_events_with_referral(
    p_first_name, p_last_name, p_display_phone, p_normalized_phone, p_phone_country,
    p_email, p_normalized_email, p_fitness_experience, p_event_ids,
    p_participation_acknowledgment_version_id, p_data_use_acknowledgment_version_id,
    p_participation_acknowledged_at, p_data_use_acknowledged_at,
    p_ip_address, p_user_agent, p_idempotency_key, null, null
  );
end;
$$;

revoke all on function public.register_selected_events_with_referral(text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text) from public, anon, authenticated;
grant execute on function public.register_selected_events_with_referral(text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text) to anon, authenticated;
revoke all on function public.register_selected_events(text,text,text,text,text,text,text,uuid,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text) from public, anon, authenticated;
grant execute on function public.register_selected_events(text,text,text,text,text,text,text,uuid,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text) to anon, authenticated;
