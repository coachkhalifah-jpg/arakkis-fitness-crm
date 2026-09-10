-- Consolidated legal acceptance: one participant interaction, five immutable
-- document versions. Legacy acknowledgment_versions and acceptance rows remain
-- unchanged and readable for historical registrations.

create table public.legal_packages (
  id uuid primary key,
  package_version text not null unique,
  effective_at timestamptz not null,
  approval_status text not null check (approval_status in ('DRAFT', 'APPROVED', 'RETIRED', 'REVOKED')),
  content_hash bytea not null,
  approved_at timestamptz,
  retired_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (approval_status <> 'APPROVED' or approved_at is not null),
  check (approval_status not in ('RETIRED', 'REVOKED') or retired_at is not null or revoked_at is not null)
);

create table public.legal_package_components (
  legal_package_id uuid not null references public.legal_packages(id) on delete restrict,
  document_type public.acknowledgment_type not null,
  acknowledgment_version_id uuid not null references public.acknowledgment_versions(id) on delete restrict,
  primary key (legal_package_id, document_type),
  unique (legal_package_id, acknowledgment_version_id),
  check (document_type in ('PARTICIPATION_RISK', 'LIABILITY_WAIVER', 'CANCELLATION_POLICY', 'TERMS_OF_USE', 'PRIVACY_POLICY'))
);
create index legal_package_components_version_idx
  on public.legal_package_components (acknowledgment_version_id);

create table public.registration_legal_package_acceptances (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete restrict,
  registration_group_id uuid not null references public.registration_groups(id) on delete restrict,
  legal_package_id uuid not null references public.legal_packages(id) on delete restrict,
  package_version text not null,
  package_effective_at timestamptz not null,
  package_content_hash bytea not null,
  component_versions jsonb not null,
  accepted_at timestamptz not null default now(),
  acceptance_method text not null,
  ip_address inet not null,
  user_agent text not null,
  unique (registration_group_id, legal_package_id),
  check (jsonb_typeof(component_versions) = 'array')
);
create index registration_legal_package_acceptances_participant_idx
  on public.registration_legal_package_acceptances (participant_id, accepted_at desc);
create index registration_legal_package_acceptances_group_idx
  on public.registration_legal_package_acceptances (registration_group_id, accepted_at);

alter table public.legal_packages enable row level security;
alter table public.legal_package_components enable row level security;
alter table public.registration_legal_package_acceptances enable row level security;
revoke all on public.legal_packages, public.legal_package_components,
  public.registration_legal_package_acceptances from anon, authenticated;

create or replace function public.prevent_legal_package_change()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'legal package definitions and evidence are immutable' using errcode = '42501';
end;
$$;
create trigger legal_packages_immutable
  before update or delete on public.legal_packages
  for each row execute function public.prevent_legal_package_change();
create trigger legal_package_components_immutable
  before update or delete on public.legal_package_components
  for each row execute function public.prevent_legal_package_change();

create or replace function public.prevent_registration_legal_package_acceptance_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'legal package acceptance evidence cannot be deleted' using errcode = '42501';
  end if;
  if new.participant_id is distinct from old.participant_id
     or new.registration_group_id is distinct from old.registration_group_id
     or new.legal_package_id is distinct from old.legal_package_id
     or new.package_version is distinct from old.package_version
     or new.package_effective_at is distinct from old.package_effective_at
     or new.package_content_hash is distinct from old.package_content_hash
     or new.component_versions is distinct from old.component_versions
     or new.accepted_at is distinct from old.accepted_at
     or new.acceptance_method is distinct from old.acceptance_method
     or new.ip_address is distinct from old.ip_address
     or new.user_agent is distinct from old.user_agent then
    raise exception 'legal package acceptance evidence is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger registration_legal_package_acceptances_immutable
  before update or delete on public.registration_legal_package_acceptances
  for each row execute function public.prevent_registration_legal_package_acceptance_change();

insert into public.legal_packages
  (id, package_version, effective_at, approval_status, content_hash, approved_at)
select
  '04100000-0000-0000-0000-000000000001'::uuid,
  '1.0.0',
  '2026-08-03T00:00:00Z',
  'APPROVED',
  extensions.digest(string_agg(c.document_type::text || ':' || v.id::text || ':' || encode(v.content_hash, 'hex'), '|' order by c.document_type), 'sha256'),
  '2026-08-03T00:00:00Z'
from (values
  ('PARTICIPATION_RISK'::public.acknowledgment_type, '03500000-0000-0000-0000-000000000001'::uuid),
  ('LIABILITY_WAIVER'::public.acknowledgment_type, '03500000-0000-0000-0000-000000000002'::uuid),
  ('CANCELLATION_POLICY'::public.acknowledgment_type, '03500000-0000-0000-0000-000000000003'::uuid),
  ('TERMS_OF_USE'::public.acknowledgment_type, '03500000-0000-0000-0000-000000000004'::uuid),
  ('PRIVACY_POLICY'::public.acknowledgment_type, '03500000-0000-0000-0000-000000000005'::uuid)
) as c(document_type, acknowledgment_version_id)
join public.acknowledgment_versions v on v.id = c.acknowledgment_version_id
on conflict (id) do nothing;

insert into public.legal_package_components (legal_package_id, document_type, acknowledgment_version_id)
values
  ('04100000-0000-0000-0000-000000000001', 'PARTICIPATION_RISK', '03500000-0000-0000-0000-000000000001'),
  ('04100000-0000-0000-0000-000000000001', 'LIABILITY_WAIVER', '03500000-0000-0000-0000-000000000002'),
  ('04100000-0000-0000-0000-000000000001', 'CANCELLATION_POLICY', '03500000-0000-0000-0000-000000000003'),
  ('04100000-0000-0000-0000-000000000001', 'TERMS_OF_USE', '03500000-0000-0000-0000-000000000004'),
  ('04100000-0000-0000-0000-000000000001', 'PRIVACY_POLICY', '03500000-0000-0000-0000-000000000005')
on conflict (legal_package_id, document_type) do nothing;

create or replace function public.legal_package_is_valid(p_legal_package_id uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  with required_types(document_type) as (
    values
      ('PARTICIPATION_RISK'::public.acknowledgment_type),
      ('LIABILITY_WAIVER'::public.acknowledgment_type),
      ('CANCELLATION_POLICY'::public.acknowledgment_type),
      ('TERMS_OF_USE'::public.acknowledgment_type),
      ('PRIVACY_POLICY'::public.acknowledgment_type)
  ), package_row as (
    select p.* from public.legal_packages p
    where p.id = p_legal_package_id
      and p.approval_status = 'APPROVED'
      and p.approved_at is not null
      and p.effective_at <= now()
      and p.retired_at is null
      and p.revoked_at is null
  ), components as (
    select c.document_type, c.acknowledgment_version_id, v.content_hash, v.type,
           v.version, v.exact_text, v.effective_at, v.legal_status, v.retired_at
    from public.legal_package_components c
    join public.acknowledgment_versions v on v.id = c.acknowledgment_version_id
    where c.legal_package_id = p_legal_package_id
  ), valid_components as (
    select count(*) as total,
           count(*) filter (where rt.document_type is not null) as required_total,
           count(*) filter (where c.type = c.document_type and c.legal_status = 'APPROVED'
                                  and c.effective_at <= now() and c.retired_at is null) as valid_total
    from components c
    left join required_types rt on rt.document_type = c.document_type
  ), package_hash as (
    select digest(string_agg(c.document_type::text || ':' || c.acknowledgment_version_id::text || ':' || encode(c.content_hash, 'hex'), '|' order by c.document_type), 'sha256') as hash
    from components c
  )
  select exists (select 1 from package_row)
     and (select total = 5 and required_total = 5 and valid_total = 5 from valid_components)
     and (select p.content_hash = h.hash from package_row p cross join package_hash h);
$$;
revoke all on function public.legal_package_is_valid(uuid) from public, anon, authenticated;
grant execute on function public.legal_package_is_valid(uuid) to service_role;

create or replace function public.get_public_registration_config()
returns jsonb language sql security definer set search_path = public as $$
select jsonb_build_object(
  'participation', (select jsonb_build_object('id',v.id,'version',v.version,'text',v.exact_text) from public.acknowledgment_versions v where v.type='PARTICIPATION_RISK' and v.legal_status='APPROVED' and v.effective_at<=now() and v.retired_at is null order by v.version desc limit 1),
  'data_use', (select jsonb_build_object('id',v.id,'version',v.version,'text',v.exact_text) from public.acknowledgment_versions v where v.type='DATA_USE' and v.legal_status in ('APPROVED','PROVISIONAL') and v.effective_at<=now() and v.retired_at is null order by v.version desc limit 1),
  'legal_package', (select jsonb_build_object(
    'id', p.id,
    'version', p.package_version,
    'effective_at', p.effective_at,
    'content_hash', encode(p.content_hash, 'hex'),
    'components', (select jsonb_agg(jsonb_build_object('id',v.id,'type',c.document_type,'version',v.version,'text',v.exact_text,'effective_at',v.effective_at) order by c.document_type) from public.legal_package_components c join public.acknowledgment_versions v on v.id=c.acknowledgment_version_id where c.legal_package_id=p.id)
  ) from public.legal_packages p where public.legal_package_is_valid(p.id) order by p.effective_at desc limit 1),
  'legal_documents', coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'type',v.type,'version',v.version,'text',v.exact_text,'effective_at',v.effective_at) order by v.type) from public.acknowledgment_versions v where v.type in ('PARTICIPATION_RISK','LIABILITY_WAIVER','CANCELLATION_POLICY','TERMS_OF_USE','PRIVACY_POLICY','MEDIA_CONSENT') and v.legal_status='APPROVED' and v.effective_at<=now() and v.retired_at is null),'[]'::jsonb),
  'organizations', coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name) from public.organizations o where o.active_status='ACTIVE'),'[]'::jsonb)
);
$$;

-- Keep the legacy argument shape callable for controlled compatibility, but
-- route it through the same authoritative active-package implementation.
create or replace function public.register_selected_events_with_legal(
  p_first_name text,p_last_name text,p_display_phone text,p_normalized_phone text,p_phone_country text,
  p_email text,p_normalized_email text,p_fitness_experience text,p_event_ids uuid[],
  p_participation_acknowledgment_version_id uuid,p_data_use_acknowledgment_version_id uuid,
  p_participation_acknowledged_at timestamptz,p_data_use_acknowledged_at timestamptz,
  p_ip_address inet,p_user_agent text,p_idempotency_key text,
  p_referral_source text,p_referral_source_other_text text,
  p_legal_document_version_ids uuid[],
  p_legal_package_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_result jsonb; v_group_id uuid; v_participant_id uuid; v_package_version text;
  v_package_effective_at timestamptz; v_package_content_hash bytea; v_components jsonb;
  v_participation uuid; v_data_use uuid; v_component_ids uuid[];
begin
  if not public.legal_package_is_valid(p_legal_package_id) then
    raise exception 'current legal package is unavailable' using errcode = '22023';
  end if;
  if p_data_use_acknowledgment_version_id is null then
    raise exception 'current data-use acknowledgment is unavailable' using errcode = '22023';
  end if;
  select p.package_version,p.effective_at,p.content_hash,
    (select jsonb_agg(jsonb_build_object('type',c.document_type,'id',v.id,'version',v.version,'content_hash',encode(v.content_hash,'hex')) order by c.document_type)
       from public.legal_package_components c join public.acknowledgment_versions v on v.id=c.acknowledgment_version_id where c.legal_package_id=p.id),
    (select c.acknowledgment_version_id from public.legal_package_components c where c.legal_package_id=p.id and c.document_type='PARTICIPATION_RISK'),
    (select v.id from public.acknowledgment_versions v where v.type='DATA_USE' and v.legal_status in ('APPROVED','PROVISIONAL') and v.effective_at <= now() and v.retired_at is null order by v.version desc limit 1)
  into v_package_version,v_package_effective_at,v_package_content_hash,v_components,v_participation,v_data_use
  from public.legal_packages p where p.id=p_legal_package_id;
  select array_agg(c.acknowledgment_version_id order by c.document_type) into v_component_ids
    from public.legal_package_components c where c.legal_package_id=p_legal_package_id;
  if p_participation_acknowledgment_version_id is distinct from v_participation
     or p_legal_document_version_ids is distinct from v_component_ids then
    raise exception 'legal package components do not match the active package' using errcode = '22023';
  end if;
  -- The legacy transaction writes the existing individual evidence rows and
  -- registration. Its DATA_USE compatibility field is retained separately;
  -- package evidence records the authoritative Privacy Policy version.
  v_result := public.register_selected_events_with_legal_legacy(
    p_first_name,p_last_name,p_display_phone,p_normalized_phone,p_phone_country,
    p_email,p_normalized_email,p_fitness_experience,p_event_ids,
    v_participation,v_data_use,p_participation_acknowledged_at,p_data_use_acknowledged_at,
    p_ip_address,p_user_agent,p_idempotency_key,p_referral_source,p_referral_source_other_text,
    v_component_ids
  );
  v_group_id := nullif(v_result->>'registration_group_id','')::uuid;
  select participant_id into v_participant_id from public.registration_groups where id=v_group_id;
  insert into public.registration_legal_package_acceptances
    (participant_id,registration_group_id,legal_package_id,package_version,package_effective_at,package_content_hash,component_versions,accepted_at,acceptance_method,ip_address,user_agent)
  values
    (v_participant_id,v_group_id,p_legal_package_id,v_package_version,v_package_effective_at,v_package_content_hash,v_components,coalesce(p_participation_acknowledged_at,now()),'PUBLIC_REGISTRATION',p_ip_address,p_user_agent)
  on conflict (registration_group_id,legal_package_id) do nothing;
  return v_result;
end;
$$;

alter function public.register_selected_events_with_legal(
  text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[]
) rename to register_selected_events_with_legal_legacy;

-- Recreate the two public-facing overloads after the rename: the old shape
-- resolves the active package, while the new shape requires the package ID.
create or replace function public.register_selected_events_with_legal(
  p_first_name text,p_last_name text,p_display_phone text,p_normalized_phone text,p_phone_country text,
  p_email text,p_normalized_email text,p_fitness_experience text,p_event_ids uuid[],
  p_participation_acknowledgment_version_id uuid,p_data_use_acknowledgment_version_id uuid,
  p_participation_acknowledged_at timestamptz,p_data_use_acknowledged_at timestamptz,
  p_ip_address inet,p_user_agent text,p_idempotency_key text,
  p_referral_source text,p_referral_source_other_text text,
  p_legal_document_version_ids uuid[]
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare active_package uuid;
begin
  select p.id into active_package from public.legal_packages p where public.legal_package_is_valid(p.id) order by p.effective_at desc limit 1;
  if active_package is null then raise exception 'current legal package is unavailable' using errcode='22023'; end if;
  return public.register_selected_events_with_legal(
    p_first_name,p_last_name,p_display_phone,p_normalized_phone,p_phone_country,p_email,p_normalized_email,p_fitness_experience,p_event_ids,
    p_participation_acknowledgment_version_id,p_data_use_acknowledgment_version_id,p_participation_acknowledged_at,p_data_use_acknowledged_at,
    p_ip_address,p_user_agent,p_idempotency_key,p_referral_source,p_referral_source_other_text,p_legal_document_version_ids,active_package
  );
end;
$$;

revoke all on function public.register_selected_events_with_legal_legacy(text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[]) from public, anon, authenticated;
revoke all on function public.register_selected_events_with_legal(text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[],uuid) from public;
grant execute on function public.register_selected_events_with_legal(text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[],uuid) to anon, authenticated;
revoke all on function public.register_selected_events_with_legal(text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[]) from public;
grant execute on function public.register_selected_events_with_legal(text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[]) to anon, authenticated;
