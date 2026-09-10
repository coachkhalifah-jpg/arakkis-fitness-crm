-- DEC-057: prospectively simplify pilot registration to one required waiver.
-- Historical packages and acceptance evidence remain untouched.

alter table public.registration_groups
  alter column data_use_acknowledgment_version_id drop not null,
  alter column data_use_acknowledged_at drop not null;

alter type public.acknowledgment_type add value if not exists 'EOKE_PARTICIPATION_WAIVER';
commit;

alter table public.legal_package_components
  drop constraint if exists legal_package_components_document_type_check;
alter table public.legal_package_components
  add constraint legal_package_components_document_type_check
  check (document_type in ('PARTICIPATION_RISK', 'EOKE_PARTICIPATION_WAIVER', 'LIABILITY_WAIVER', 'CANCELLATION_POLICY', 'TERMS_OF_USE', 'PRIVACY_POLICY'));

alter table public.legal_packages
  add column if not exists owner_approval_status text,
  add column if not exists owner_approval_date date,
  add column if not exists provenance text;

insert into public.acknowledgment_versions
  (id, type, version, exact_text, content_hash, effective_at, legal_status, created_by_admin_id)
values (
  '06400000-0000-0000-0000-000000000001',
  'EOKE_PARTICIPATION_WAIVER',
  1000,
  $p$
EOKE LLC PARTICIPATION LIABILITY WAIVER

Version 1.0

The individual accepting this Waiver (referred to as "I" or "me") desires to participate in boxing, boxing fitness, group fitness, strength and conditioning, personal training, and related physical activities (the "Activity") sponsored, organized, or instructed by Eoke LLC ("Eoke"), including Activities conducted at facilities owned or operated by third-party host facilities or partner locations (each, a "Host Facility"). In consideration of the intangible value that I will gain by participating in the Activity and in recognition of Eoke and the applicable Host Facility's reliance hereon, I agree to all the terms and conditions set forth in this instrument (this "Waiver").

I am aware and understand that the Activity is a potentially dangerous Activity and involves the risk of serious injury, disability, death and/or property damage. I acknowledge that any injuries that I sustain may result from or be compounded by the actions, omissions, or negligence of Eoke or the applicable Host Facility, including negligent emergency response or rescue operations of Eoke or the applicable Host Facility. I acknowledge that the Activity requires a minimum level of fitness, ability, and health (physical, mental, and emotional), and each person has a different capacity for participating in the Activity.

I warrant that I am physically fit to participate in the Activity, and that my participation is voluntary, and taken with the knowledge of the dangers involved.

I HEREBY AGREE TO ACCEPT AND ASSUME ANY AND ALL RISKS OF INJURY, DISABILITY, DEATH, AND/OR PROPERTY DAMAGE ARISING FROM MY PARTICIPATION IN THE ACTIVITY, WHETHER CAUSED BY THE ORDINARY NEGLIGENCE OF EOKE AND/OR THE APPLICABLE HOST FACILITY, OR OTHERWISE.

I hereby expressly waive and release any and all claims, now known or hereafter known, against Eoke, the applicable Host Facility, and their respective owners, officers, directors, managers, members, employees, coaches, trainers, contractors, agents, affiliates, successors, and assigns (collectively, "Releasees"), on account of injury, disability, death, or property loss or damage arising out of or attributable to my participation in the Activity, whether arising out of the ordinary negligence of Eoke, the applicable Host Facility, or any Releasees or otherwise. I covenant not to make or bring any such claim against Eoke, the applicable Host Facility, or any other Releasee, and forever release and discharge Eoke, the applicable Host Facility, and all other Releasees from liability under such claims.

I shall defend, indemnify, and hold harmless Eoke, the applicable Host Facility, and all other Releasees against any and all losses, damages, liabilities, deficiencies, claims, actions, judgments, settlements, interest, awards, penalties, fines, costs, or expenses of whatever kind, including attorney fees, fees, the costs of enforcing any right to indemnification under this Waiver, and the cost of pursuing any insurance providers, arising out or resulting from any claim of a third party related to my participation in the Activity, including any claim related to my own negligence or the ordinary negligence of Eoke and/or the applicable Host Facility.

I hereby consent to receive medical treatment deemed necessary if I am injured or require medical attention during my participation in the Activity. I understand and agree that I am solely responsible for all costs related to such medical treatment and any related medical transportation and/or evacuation. I hereby release, forever discharge, and hold harmless Eoke and the applicable Host Facility from any claim based on such treatment or other medical services.

ELECTRONIC ACKNOWLEDGMENT

By affirmatively accepting this Waiver through Arakkis, I acknowledge that I have read this Waiver, understand that I am giving up substantial legal rights, including the right to sue to the extent stated above, and accept it freely and voluntarily. My electronic acceptance may be recorded with my identity, the applicable booking or registration, this Waiver version, its effective date, and the date and time of acceptance.
$p$,
  decode('1550b481c6946f0cfb75183c5bebb894c4c251505eb90bcc553edeff37d9eeed', 'hex'),
  '2026-08-27T00:00:00Z',
  'APPROVED',
  null
)
on conflict (id) do nothing;

insert into public.legal_packages
  (id, package_version, effective_at, approval_status, content_hash, approved_at,
   owner_approval_status, owner_approval_date, provenance)
values (
  '06400000-0000-0000-0000-000000000001',
  '1.0',
  '2026-08-27T00:00:00Z',
  'APPROVED',
  digest('EOKE_PARTICIPATION_WAIVER:06400000-0000-0000-0000-000000000001:' || encode((select content_hash from public.acknowledgment_versions where id='06400000-0000-0000-0000-000000000001'), 'hex'), 'sha256'),
  '2026-08-25T00:00:00Z',
  'OWNER APPROVED',
  '2026-08-25',
  'Adapted from lawyer-approved boxing waiver supplied by Product Owner; Eoke-specific adaptations approved by Owner; independent attorney approval of adaptations not claimed.'
)
on conflict (id) do nothing;

insert into public.legal_package_components
  (legal_package_id, document_type, acknowledgment_version_id)
values
  ('06400000-0000-0000-0000-000000000001', 'EOKE_PARTICIPATION_WAIVER', '06400000-0000-0000-0000-000000000001')
on conflict (legal_package_id, document_type) do nothing;

create or replace function public.legal_package_is_valid(p_legal_package_id uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  with package_row as (
    select p.* from public.legal_packages p
    where p.id = p_legal_package_id
      and p.approval_status = 'APPROVED'
      and p.owner_approval_status = 'OWNER APPROVED'
      and p.owner_approval_date is not null
      and p.approved_at is not null
      and (p.effective_at <= now() or current_setting('app.environment', true) in ('development','test','staging'))
      and p.retired_at is null and p.revoked_at is null
  ), components as (
    select c.document_type, c.acknowledgment_version_id, v.content_hash, v.type,
           v.effective_at, v.legal_status, v.retired_at
    from public.legal_package_components c
    join public.acknowledgment_versions v on v.id = c.acknowledgment_version_id
    where c.legal_package_id = p_legal_package_id
  ), package_hash as (
    select digest(string_agg(c.document_type::text || ':' || c.acknowledgment_version_id::text || ':' || encode(c.content_hash, 'hex'), '|' order by c.document_type), 'sha256') as hash
    from components c
  )
  select exists (select 1 from package_row)
     and (select count(*) = 1 and bool_and(document_type = 'EOKE_PARTICIPATION_WAIVER' and type = document_type and legal_status = 'APPROVED' and (effective_at <= now() or current_setting('app.environment', true) in ('development','test','staging')) and retired_at is null) from components)
     and (select p.content_hash = h.hash from package_row p cross join package_hash h);
$$;

create or replace function public.get_public_registration_config()
returns jsonb language sql security definer set search_path = public as $$
select jsonb_build_object(
  'participation', null,
  'data_use', null,
  'legal_package', (select jsonb_build_object(
    'id', p.id, 'version', p.package_version, 'effective_at', p.effective_at,
    'content_hash', encode(p.content_hash, 'hex'),
    'components', (select jsonb_agg(jsonb_build_object('id',v.id,'type',c.document_type,'version',v.version,'text',v.exact_text,'effective_at',v.effective_at) order by c.document_type)
      from public.legal_package_components c join public.acknowledgment_versions v on v.id=c.acknowledgment_version_id where c.legal_package_id=p.id)
  ) from public.legal_packages p where public.legal_package_is_valid(p.id) order by p.effective_at desc limit 1),
  'legal_documents', coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'type',v.type,'version',v.version,'text',v.exact_text,'effective_at',v.effective_at) order by v.type)
    from public.acknowledgment_versions v where v.type in ('LIABILITY_WAIVER','CANCELLATION_POLICY','TERMS_OF_USE','PRIVACY_POLICY') and v.legal_status='APPROVED' and v.effective_at<=now() and v.retired_at is null),'[]'::jsonb),
  'organizations', coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name) from public.organizations o where o.active_status='ACTIVE'),'[]'::jsonb)
);
$$;

create or replace function public.register_selected_events_with_legal(
  p_first_name text,p_last_name text,p_display_phone text,p_normalized_phone text,p_phone_country text,
  p_email text,p_normalized_email text,p_fitness_experience text,p_goals text,p_event_ids uuid[],
  p_participation_acknowledgment_version_id uuid,p_data_use_acknowledgment_version_id uuid,
  p_participation_acknowledged_at timestamptz,p_data_use_acknowledged_at timestamptz,
  p_ip_address inet,p_user_agent text,p_idempotency_key text,p_referral_source text,
  p_referral_source_other_text text,p_legal_document_version_ids uuid[],p_legal_package_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
<<registration>>
declare
  participant_id uuid; group_id uuid; event_id uuid; event_row public.events%rowtype;
  registration_id uuid; token text := encode(gen_random_bytes(32), 'base64');
  result jsonb := '[]'::jsonb; active_count integer; waiver_id uuid;
begin
  if coalesce(array_length(p_event_ids, 1), 0) = 0 then raise exception 'at least one event is required'; end if;
  if p_user_agent is null or p_ip_address is null then raise exception 'registration evidence is required'; end if;
  if p_idempotency_key is not null then
    select id into group_id from public.registration_groups where submission_source='PUBLIC' and idempotency_key=p_idempotency_key;
    if group_id is not null then
      return jsonb_build_object('registration_group_id',group_id,'confirmation_token',null,'results',coalesce((select jsonb_agg(jsonb_build_object('event_id',r.event_id,'registration_id',r.id,'success',true)) from public.registrations r where r.registration_group_id=group_id),'[]'::jsonb));
    end if;
  end if;
  if not public.legal_package_is_valid(p_legal_package_id) then raise exception 'current legal package is unavailable' using errcode='22023'; end if;
  select c.acknowledgment_version_id into waiver_id from public.legal_package_components c where c.legal_package_id=p_legal_package_id and c.document_type='EOKE_PARTICIPATION_WAIVER';
  if p_participation_acknowledgment_version_id is distinct from waiver_id
     or coalesce(array_length(p_legal_document_version_ids,1),0) <> 1
     or p_legal_document_version_ids[1] is distinct from waiver_id
     or p_data_use_acknowledgment_version_id is not null then
    raise exception 'the current waiver acknowledgment is required' using errcode='22023';
  end if;
  select p.id into participant_id from public.participants p where p.normalized_phone=p_normalized_phone and p.normalized_first_name=lower(btrim(p_first_name)) and p.normalized_last_name=lower(btrim(p_last_name)) order by p.created_at limit 1 for update;
  if participant_id is null then
    insert into public.participants(first_name,last_name,normalized_first_name,normalized_last_name,display_phone,normalized_phone,phone_country,email,normalized_email,fitness_experience,goals)
    values(p_first_name,p_last_name,lower(btrim(p_first_name)),lower(btrim(p_last_name)),p_display_phone,p_normalized_phone,p_phone_country,p_email,p_normalized_email,p_fitness_experience,nullif(btrim(p_goals),'')) returning id into participant_id;
  else
  update public.participants set goals=nullif(btrim(p_goals),'') where id=registration.participant_id and p_goals is not null;
  end if;
  insert into public.registration_groups(participant_id,submission_source,participation_acknowledgment_version_id,participation_acknowledged_at,data_use_acknowledgment_version_id,data_use_acknowledged_at,idempotency_key)
  values(participant_id,'PUBLIC',waiver_id,coalesce(p_participation_acknowledged_at,now()),null,null,p_idempotency_key) returning id into group_id;
  insert into public.acknowledgment_acceptances(participant_id,registration_group_id,acknowledgment_version_id,accepted_at,acceptance_method,ip_address,user_agent)
  values(participant_id,group_id,waiver_id,coalesce(p_participation_acknowledged_at,now()),'PUBLIC_REGISTRATION',p_ip_address,p_user_agent);
  insert into public.registration_legal_package_acceptances(participant_id,registration_group_id,legal_package_id,package_version,package_effective_at,package_content_hash,component_versions,accepted_at,acceptance_method,ip_address,user_agent)
  select participant_id,group_id,p.id,p.package_version,p.effective_at,p.content_hash,jsonb_build_array(jsonb_build_object('type','EOKE_PARTICIPATION_WAIVER','id',waiver_id,'version',v.version,'content_hash',encode(v.content_hash,'hex'))),coalesce(p_participation_acknowledged_at,now()),'PUBLIC_REGISTRATION',p_ip_address,p_user_agent
  from public.legal_packages p join public.acknowledgment_versions v on v.id=waiver_id where p.id=p_legal_package_id;
  foreach event_id in array p_event_ids loop
    select * into event_row from public.events where id=event_id for update;
    if not found then result:=result||jsonb_build_object('event_id',event_id,'success',false,'reason','NOT_FOUND'); continue; end if;
    if event_row.status<>'OPEN' or event_row.registration_deadline<now() or event_row.starts_at<=now() then result:=result||jsonb_build_object('event_id',event_id,'success',false,'reason','CLOSED'); continue; end if;
    if exists(select 1 from public.registrations r where r.participant_id=registration.participant_id and r.event_id=registration.event_id and r.registration_status='REGISTERED' and r.registration_outcome='ACTIVE') then result:=result||jsonb_build_object('event_id',event_id,'success',false,'reason','ALREADY_REGISTERED'); continue; end if;
    select count(*) into active_count from public.registrations r where r.event_id=registration.event_id and r.registration_status='REGISTERED' and r.registration_outcome='ACTIVE';
    if active_count>=event_row.capacity then result:=result||jsonb_build_object('event_id',event_id,'success',false,'reason','FULL'); continue; end if;
    insert into public.registrations(registration_group_id,participant_id,event_id) values(group_id,participant_id,event_id) returning id into registration_id;
    result:=result||jsonb_build_object('event_id',event_id,'registration_id',registration_id,'success',true);
  end loop;
  insert into public.confirmation_tokens(registration_group_id,token_hash,expires_at) values(group_id,digest(token,'sha256'),now()+interval '24 hours');
  return jsonb_build_object('registration_group_id',group_id,'confirmation_token',token,'results',result);
end;
$$;

revoke all on function public.register_selected_events_with_legal(text,text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[],uuid) from public;
grant execute on function public.register_selected_events_with_legal(text,text,text,text,text,text,text,text,text,uuid[],uuid,uuid,timestamptz,timestamptz,inet,text,text,text,text,uuid[],uuid) to anon, authenticated;
