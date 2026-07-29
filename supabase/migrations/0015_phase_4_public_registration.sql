-- Phase 4: public registration eligibility, deterministic matching, and token-scoped reads.
-- Migrations 0001-0014 are immutable.

create table public.registration_group_results (
  id uuid primary key default gen_random_uuid(), registration_group_id uuid not null references public.registration_groups(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict, success boolean not null,
  reason text, registration_id uuid references public.registrations(id) on delete restrict,
  created_at timestamptz not null default now(), constraint registration_group_result_reason check (success or reason is not null)
);
create unique index registration_group_results_event_uq on public.registration_group_results (registration_group_id, event_id);
alter table public.registration_group_results enable row level security;
create policy system_admin_all_registration_group_results on public.registration_group_results for all to authenticated using (public.is_active_system_admin()) with check (public.is_active_system_admin());
revoke all on public.registration_group_results from anon;
grant select on public.registration_group_results to authenticated;

drop view public.public_event_schedule;
create view public.public_event_schedule with (security_invoker = false) as
select e.id, e.name, e.description, e.participant_instructions, e.starts_at, e.ends_at, e.timezone, e.capacity,
       e.registration_deadline, e.visibility, e.host_organization_id, e.venue_id,
       o.name as host_organization_name, v.name as venue_name, v.street as venue_street,
       v.city as venue_city, v.state as venue_state, v.postal_code as venue_postal_code,
       (select count(*)::integer from public.registrations r
        where r.event_id = e.id and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE') as active_registration_count
from public.events e
join public.organizations o on o.id = e.host_organization_id and o.active_status = 'ACTIVE'
join public.venues v on v.id = e.venue_id and v.active_status = 'ACTIVE'
where e.status = 'OPEN' and e.archived_at is null and e.starts_at > now() and e.registration_deadline >= now();
grant select on public.public_event_schedule to anon, authenticated;

create or replace function public.register_selected_events(
  p_first_name text, p_last_name text, p_display_phone text, p_normalized_phone text, p_phone_country text,
  p_email text, p_normalized_email text, p_primary_affiliation_organization_id uuid, p_affiliation_other_text text,
  p_fitness_experience text, p_event_ids uuid[], p_participation_acknowledgment_version_id uuid,
  p_data_use_acknowledgment_version_id uuid, p_participation_acknowledged_at timestamptz,
  p_data_use_acknowledged_at timestamptz, p_ip_address inet, p_user_agent text, p_idempotency_key text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_participant_id uuid;
  v_group_id uuid;
  v_token text := regexp_replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=+$', '');
  v_event_id uuid;
  v_event_row public.events%rowtype;
  v_registration_id uuid;
  v_result jsonb := '[]'::jsonb;
  v_active_count integer;
  v_affiliation_allowed boolean;
  v_exact_match_count integer;
begin
  if coalesce(array_length(p_event_ids, 1), 0) = 0 or array_length(p_event_ids, 1) > 50 then raise exception 'invalid event selection' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_first_name, ''))) not between 1 and 100
     or char_length(btrim(coalesce(p_last_name, ''))) not between 1 and 100
     or char_length(btrim(coalesce(p_display_phone, ''))) not between 3 and 40
     or p_normalized_phone !~ '^\+[1-9][0-9]{7,14}$'
     or char_length(btrim(coalesce(p_phone_country, ''))) not between 2 and 3
     or p_user_agent is null or p_ip_address is null then raise exception 'invalid registration submission' using errcode = '22023'; end if;
  if p_email is not null and (char_length(btrim(p_email)) > 254 or p_normalized_email is distinct from lower(btrim(p_email))
     or p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'invalid registration submission' using errcode = '22023'; end if;
  if p_primary_affiliation_organization_id is not null and not exists (select 1 from public.organizations o where o.id = p_primary_affiliation_organization_id and o.active_status = 'ACTIVE') then raise exception 'invalid affiliation' using errcode = '22023'; end if;
  if p_participation_acknowledged_at is null or p_data_use_acknowledged_at is null then raise exception 'acknowledgment evidence is required' using errcode = '22023'; end if;
  if not exists (select 1 from public.acknowledgment_versions v where v.id = p_participation_acknowledgment_version_id and v.type = 'PARTICIPATION_RISK' and v.legal_status in ('APPROVED', 'PROVISIONAL') and v.effective_at <= now() and v.retired_at is null) then raise exception 'invalid Participation acknowledgment version' using errcode = '22023'; end if;
  if not exists (select 1 from public.acknowledgment_versions v where v.id = p_data_use_acknowledgment_version_id and v.type = 'DATA_USE' and v.legal_status in ('APPROVED', 'PROVISIONAL') and v.effective_at <= now() and v.retired_at is null) then raise exception 'invalid Data Use acknowledgment version' using errcode = '22023'; end if;
  if p_idempotency_key is not null and char_length(p_idempotency_key) > 100 then raise exception 'invalid submission key' using errcode = '22023'; end if;

  if p_idempotency_key is not null then
    select rg.id into v_group_id from public.registration_groups rg where rg.submission_source = 'PUBLIC' and rg.idempotency_key = p_idempotency_key;
    if v_group_id is not null then
      return jsonb_build_object('registration_group_id', v_group_id, 'confirmation_token', null, 'results', coalesce((select jsonb_agg(jsonb_build_object('event_id', gr.event_id, 'registration_id', gr.registration_id, 'success', gr.success, 'reason', gr.reason)) from public.registration_group_results gr where gr.registration_group_id = v_group_id), '[]'::jsonb));
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_normalized_phone || '|' || lower(btrim(p_first_name)) || '|' || lower(btrim(p_last_name)), 4096));
  select count(*) into v_exact_match_count from public.participants p where p.status = 'ACTIVE' and p.normalized_phone = p_normalized_phone and p.normalized_first_name = lower(btrim(p_first_name)) and p.normalized_last_name = lower(btrim(p_last_name));
  if v_exact_match_count > 1 then raise exception 'ambiguous participant match' using errcode = '23514'; end if;
  select p.id into v_participant_id from public.participants p where p.status = 'ACTIVE' and p.normalized_phone = p_normalized_phone and p.normalized_first_name = lower(btrim(p_first_name)) and p.normalized_last_name = lower(btrim(p_last_name));
  if v_participant_id is null then
    insert into public.participants (first_name, last_name, normalized_first_name, normalized_last_name, display_phone, normalized_phone, phone_country, email, normalized_email, primary_affiliation_organization_id, affiliation_other_text, fitness_experience)
    values (btrim(p_first_name), btrim(p_last_name), lower(btrim(p_first_name)), lower(btrim(p_last_name)), btrim(p_display_phone), p_normalized_phone, upper(btrim(p_phone_country)), nullif(lower(btrim(p_email)), ''), nullif(lower(btrim(p_normalized_email)), ''), p_primary_affiliation_organization_id, nullif(btrim(p_affiliation_other_text), ''), nullif(btrim(p_fitness_experience), '')) returning id into v_participant_id;
  else
    update public.participants set display_phone = btrim(p_display_phone), normalized_phone = p_normalized_phone, phone_country = upper(btrim(p_phone_country)), email = nullif(lower(btrim(p_email)), ''), normalized_email = nullif(lower(btrim(p_normalized_email)), ''), primary_affiliation_organization_id = p_primary_affiliation_organization_id, affiliation_other_text = nullif(btrim(p_affiliation_other_text), ''), fitness_experience = nullif(btrim(p_fitness_experience), '') where id = v_participant_id;
  end if;
  insert into public.registration_groups (participant_id, submission_source, participation_acknowledgment_version_id, participation_acknowledged_at, data_use_acknowledgment_version_id, data_use_acknowledged_at, idempotency_key) values (v_participant_id, 'PUBLIC', p_participation_acknowledgment_version_id, p_participation_acknowledged_at, p_data_use_acknowledgment_version_id, p_data_use_acknowledged_at, p_idempotency_key) returning id into v_group_id;
  insert into public.acknowledgment_acceptances (participant_id, registration_group_id, acknowledgment_version_id, accepted_at, acceptance_method, ip_address, user_agent) values (v_participant_id, v_group_id, p_participation_acknowledgment_version_id, p_participation_acknowledged_at, 'PUBLIC_REGISTRATION', p_ip_address, p_user_agent), (v_participant_id, v_group_id, p_data_use_acknowledgment_version_id, p_data_use_acknowledged_at, 'PUBLIC_REGISTRATION', p_ip_address, p_user_agent);

  for v_event_id in select distinct requested_id from unnest(p_event_ids) as selected(requested_id) loop
    select e.* into v_event_row from public.events e where e.id = v_event_id for update;
    if not found or v_event_row.archived_at is not null or v_event_row.status <> 'OPEN' or v_event_row.registration_deadline < now() or v_event_row.starts_at <= now() or not exists (select 1 from public.organizations o join public.venues v on v.organization_id = o.id where o.id = v_event_row.host_organization_id and v.id = v_event_row.venue_id and o.active_status = 'ACTIVE' and v.active_status = 'ACTIVE') then v_result := v_result || jsonb_build_object('event_id', v_event_id, 'success', false, 'reason', 'CLOSED'); continue; end if;
    if v_event_row.visibility = 'AFFILIATION_RESTRICTED' then select exists (select 1 from public.event_eligible_organizations x join public.organizations o on o.id = x.organization_id and o.active_status = 'ACTIVE' where x.event_id = v_event_row.id and x.organization_id = p_primary_affiliation_organization_id) into v_affiliation_allowed; if not v_affiliation_allowed then v_result := v_result || jsonb_build_object('event_id', v_event_id, 'success', false, 'reason', 'INELIGIBLE'); continue; end if; end if;
    if exists (select 1 from public.registrations r where r.participant_id = v_participant_id and r.event_id = v_event_id and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE') then v_result := v_result || jsonb_build_object('event_id', v_event_id, 'success', false, 'reason', 'ALREADY_REGISTERED'); continue; end if;
    select count(*) into v_active_count from public.registrations r where r.event_id = v_event_id and r.registration_status = 'REGISTERED' and r.registration_outcome = 'ACTIVE';
    if v_active_count >= v_event_row.capacity then v_result := v_result || jsonb_build_object('event_id', v_event_id, 'success', false, 'reason', 'FULL'); continue; end if;
    insert into public.registrations (registration_group_id, participant_id, event_id, affiliation_organization_id_at_registration, affiliation_other_text_at_registration) values (v_group_id, v_participant_id, v_event_id, p_primary_affiliation_organization_id, nullif(btrim(p_affiliation_other_text), '')) returning id into v_registration_id;
    v_result := v_result || jsonb_build_object('event_id', v_event_id, 'registration_id', v_registration_id, 'success', true);
  end loop;
  insert into public.confirmation_tokens (registration_group_id, token_hash, expires_at) values (v_group_id, digest(v_token, 'sha256'), now() + interval '24 hours');
  insert into public.registration_group_results (registration_group_id, event_id, success, reason, registration_id)
  select v_group_id, (item->>'event_id')::uuid, (item->>'success')::boolean, item->>'reason', nullif(item->>'registration_id', '')::uuid
  from jsonb_array_elements(v_result) item;
  insert into public.audit_events (action, entity_type, entity_id, new_values, ip_address, user_agent) values ('PUBLIC_REGISTRATION_CREATED', 'REGISTRATION_GROUP', v_group_id, jsonb_build_object('successful_count', jsonb_array_length((select jsonb_agg(item) from jsonb_array_elements(v_result) item where (item->>'success')::boolean))), p_ip_address, p_user_agent);
  return jsonb_build_object('registration_group_id', v_group_id, 'confirmation_token', v_token, 'results', v_result);
end;
$$;

create or replace function public.get_registration_confirmation(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_group_id uuid; v_token_id uuid; v_result jsonb;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{40,60}$' then raise exception 'invalid confirmation' using errcode = '42501'; end if;
  select ct.id, ct.registration_group_id into v_token_id, v_group_id from public.confirmation_tokens ct where ct.token_hash = digest(p_token, 'sha256') and ct.revoked_at is null and ct.expires_at > now() for update;
  if v_group_id is null then raise exception 'invalid confirmation' using errcode = '42501'; end if;
  update public.confirmation_tokens set last_accessed_at = now(), access_count = access_count + 1 where id = v_token_id;
  select jsonb_build_object('participant_name', p.first_name || ' ' || p.last_name, 'registration_group_id', rg.id, 'expires_at', ct.expires_at, 'events', coalesce(jsonb_agg(jsonb_build_object('event_id', e.id, 'registration_id', r.id, 'success', gr.success, 'reason', gr.reason, 'name', e.name, 'description', e.description, 'participant_instructions', e.participant_instructions, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone, 'venue_name', v.name, 'venue_street', v.street, 'venue_city', v.city, 'venue_state', v.state, 'venue_postal_code', v.postal_code, 'host_organization_name', o.name) order by e.starts_at), '[]'::jsonb)) into v_result from public.registration_groups rg join public.participants p on p.id = rg.participant_id join public.confirmation_tokens ct on ct.registration_group_id = rg.id join public.registration_group_results gr on gr.registration_group_id = rg.id left join public.registrations r on r.id = gr.registration_id left join public.events e on e.id = gr.event_id left join public.venues v on v.id = e.venue_id left join public.organizations o on o.id = e.host_organization_id where rg.id = v_group_id group by p.first_name, p.last_name, rg.id, ct.expires_at;
  return v_result;
end;
$$;

revoke all on function public.get_registration_confirmation(text) from public;
grant execute on function public.get_registration_confirmation(text) to anon, authenticated;

create or replace function public.get_public_registration_config()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'participation', (select jsonb_build_object('id', v.id, 'version', v.version, 'text', v.exact_text) from public.acknowledgment_versions v where v.type = 'PARTICIPATION_RISK' and v.legal_status in ('APPROVED', 'PROVISIONAL') and v.effective_at <= now() and v.retired_at is null order by v.version desc limit 1),
    'data_use', (select jsonb_build_object('id', v.id, 'version', v.version, 'text', v.exact_text) from public.acknowledgment_versions v where v.type = 'DATA_USE' and v.legal_status in ('APPROVED', 'PROVISIONAL') and v.effective_at <= now() and v.retired_at is null order by v.version desc limit 1),
    'organizations', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name) order by o.name) from public.organizations o where o.active_status = 'ACTIVE'), '[]'::jsonb)
  )
$$;
revoke all on function public.get_public_registration_config() from public;
grant execute on function public.get_public_registration_config() to anon, authenticated;
revoke all on function public.register_selected_events(text,text,text,text,text,text,text,uuid,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text) from public;
grant execute on function public.register_selected_events(text,text,text,text,text,text,text,uuid,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text) to anon, authenticated;
