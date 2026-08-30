-- 0068 — RC2 System Admin participant contact correction.
-- 0066 is reserved for the cancelled-Event archive slice and 0067 remains
-- reserved by the integration plan. This migration changes no child history.

-- Existing participant matching permits shared phones, but an exact active
-- identity key must not be created by a contact correction. The review case
-- constraint follows the canonical model: the candidate relationship itself
-- is sufficient when a participant has no registration source yet.
alter table public.possible_duplicate_cases
  drop constraint duplicate_case_source;

alter table public.possible_duplicate_cases
  add constraint duplicate_case_source check (
    candidate_participant_id is not null
    or possible_match_participant_id is not null
    or source_registration_id is not null
    or source_registration_group_id is not null
  );

create or replace function public.phase6_correct_participant_contact(
  p_participant_id uuid,
  p_first_name text,
  p_last_name text,
  p_display_phone text,
  p_normalized_phone text,
  p_phone_country text,
  p_email text,
  p_normalized_email text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth
as $function$
declare
  actor_id uuid := auth.uid();
  participant_row public.participants%rowtype;
  collision_row public.participants%rowtype;
  source_group_id uuid;
  source_registration_id uuid;
  duplicate_case_id uuid;
  canonical_first_name text;
  canonical_last_name text;
  canonical_display_phone text;
  canonical_phone text;
  canonical_phone_country text;
  canonical_email text;
  canonical_normalized_email text;
  canonical_reason text;
  proposed_values jsonb;
  previous_values jsonb;
begin
  if not public.is_active_system_admin() then
    raise exception 'participant correction unavailable' using errcode = '42501';
  end if;

  canonical_first_name := btrim(regexp_replace(normalize(coalesce(p_first_name, ''), NFKC), '[[:space:]]+', ' ', 'g'));
  canonical_last_name := btrim(regexp_replace(normalize(coalesce(p_last_name, ''), NFKC), '[[:space:]]+', ' ', 'g'));
  canonical_display_phone := btrim(regexp_replace(normalize(coalesce(p_display_phone, ''), NFKC), '[[:space:]]+', ' ', 'g'));
  canonical_phone := btrim(coalesce(p_normalized_phone, ''));
  canonical_phone_country := upper(btrim(coalesce(p_phone_country, '')));
  canonical_email := nullif(lower(btrim(regexp_replace(normalize(coalesce(p_email, ''), NFKC), '[[:space:]]+', ' ', 'g'))), '');
  canonical_normalized_email := nullif(lower(btrim(regexp_replace(normalize(coalesce(p_normalized_email, p_email, ''), NFKC), '[[:space:]]+', ' ', 'g'))), '');
  canonical_reason := btrim(regexp_replace(normalize(coalesce(p_reason, ''), NFKC), '[[:space:]]+', ' ', 'g'));

  if p_participant_id is null
     or char_length(canonical_first_name) not between 1 and 100
     or char_length(canonical_last_name) not between 1 and 100
     or char_length(canonical_display_phone) not between 1 and 40
     or canonical_phone !~ '^\+[1-9][0-9]{1,14}$'
     or canonical_phone_country !~ '^[A-Z]{2,3}$'
     or char_length(canonical_reason) not between 1 and 500 then
    raise exception 'participant correction input is invalid' using errcode = '22023';
  end if;

  if canonical_email is not null and canonical_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'participant email is invalid' using errcode = '22023';
  end if;
  if canonical_email is null then
    canonical_normalized_email := null;
  elsif canonical_normalized_email is distinct from canonical_email then
    raise exception 'participant email normalization is invalid' using errcode = '22023';
  end if;

  select * into participant_row
  from public.participants
  where id = p_participant_id
  for update;
  if not found or participant_row.status <> 'ACTIVE' then
    raise exception 'participant correction unavailable' using errcode = '42501';
  end if;

  if participant_row.first_name = canonical_first_name
     and participant_row.last_name = canonical_last_name
     and participant_row.display_phone = canonical_display_phone
     and participant_row.normalized_phone = canonical_phone
     and participant_row.phone_country = canonical_phone_country
     and participant_row.email is not distinct from canonical_email
     and participant_row.normalized_email is not distinct from canonical_normalized_email then
    raise exception 'participant contact is unchanged' using errcode = '22023';
  end if;

  -- Serialize corrections for the exact key so two System Admin requests
  -- cannot both pass the collision check.
  perform pg_advisory_xact_lock(hashtextextended(
    'participant-contact:' || canonical_phone || '|' || lower(canonical_first_name) || '|' || lower(canonical_last_name),
    0
  ));

  select * into collision_row
  from public.participants
  where status = 'ACTIVE'
    and id <> participant_row.id
    and normalized_phone = canonical_phone
    and normalized_first_name = lower(canonical_first_name)
    and normalized_last_name = lower(canonical_last_name)
  order by created_at, id
  limit 1
  for update;

  previous_values := jsonb_build_object(
    'first_name', participant_row.first_name,
    'last_name', participant_row.last_name,
    'display_phone', participant_row.display_phone,
    'normalized_phone', participant_row.normalized_phone,
    'phone_country', participant_row.phone_country,
    'email', participant_row.email,
    'normalized_email', participant_row.normalized_email
  );
  proposed_values := jsonb_build_object(
    'first_name', canonical_first_name,
    'last_name', canonical_last_name,
    'display_phone', canonical_display_phone,
    'normalized_phone', canonical_phone,
    'phone_country', canonical_phone_country,
    'email', canonical_email,
    'normalized_email', canonical_normalized_email
  );

  if collision_row.id is not null then
    select rg.id, r.id
      into source_group_id, source_registration_id
    from public.registration_groups rg
    left join public.registrations r on r.registration_group_id = rg.id
    where rg.participant_id = participant_row.id
    order by rg.submitted_at desc, r.registered_at desc nulls last
    limit 1;

    select id into duplicate_case_id
    from public.possible_duplicate_cases
    where status = 'OPEN'
      and candidate_participant_id = participant_row.id
      and possible_match_participant_id = collision_row.id
      and normalized_values = proposed_values
    order by created_at desc
    limit 1
    for update;

    if duplicate_case_id is null then
      insert into public.possible_duplicate_cases (
        candidate_participant_id,
        possible_match_participant_id,
        source_registration_id,
        source_registration_group_id,
        matching_signals,
        normalized_values
      ) values (
        participant_row.id,
        collision_row.id,
        source_registration_id,
        source_group_id,
        jsonb_build_object(
          'type', 'PARTICIPANT_CONTACT_CORRECTION_COLLISION',
          'fields', jsonb_build_array('normalized_phone', 'normalized_first_name', 'normalized_last_name')
        ),
        proposed_values
      ) returning id into duplicate_case_id;
    end if;

    insert into public.audit_events (
      actor_admin_id, action, entity_type, entity_id, old_values, new_values, reason
    ) values (
      actor_id,
      'PARTICIPANT_CONTACT_REVIEW_REQUIRED',
      'PARTICIPANT',
      participant_row.id,
      previous_values,
      proposed_values || jsonb_build_object('possible_duplicate_case_id', duplicate_case_id),
      canonical_reason
    );

    return jsonb_build_object(
      'status', 'REVIEW_REQUIRED',
      'participant_id', participant_row.id,
      'possible_duplicate_case_id', duplicate_case_id
    );
  end if;

  update public.participants
  set first_name = canonical_first_name,
      last_name = canonical_last_name,
      normalized_first_name = lower(canonical_first_name),
      normalized_last_name = lower(canonical_last_name),
      display_phone = canonical_display_phone,
      normalized_phone = canonical_phone,
      phone_country = canonical_phone_country,
      email = canonical_email,
      normalized_email = canonical_normalized_email
  where id = participant_row.id;

  insert into public.audit_events (
    actor_admin_id, action, entity_type, entity_id, old_values, new_values, reason
  ) values (
    actor_id,
    'PARTICIPANT_CONTACT_CORRECTED',
    'PARTICIPANT',
    participant_row.id,
    previous_values,
    proposed_values,
    canonical_reason
  );

  return jsonb_build_object('status', 'UPDATED', 'participant_id', participant_row.id);
end;
$function$;

revoke all on function public.phase6_correct_participant_contact(uuid, text, text, text, text, text, text, text, text) from public;
grant execute on function public.phase6_correct_participant_contact(uuid, text, text, text, text, text, text, text, text) to authenticated;

-- Participant writes are intentionally constrained to security-definer RPCs;
-- roster/profile reads remain available through RLS.
revoke insert, update, delete on public.participants from authenticated;
